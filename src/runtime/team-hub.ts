import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import {
  TeamAttemptGraphSchema,
  TeamAttemptSchema,
  TeamPromotionCandidateSchema,
  TeamWinnerSelectionHistorySchema,
  TeamWinnerSelectionSchema,
} from './runtime.schemas.ts'
import type {
  CreateTeamHubOptions,
  SelectPromotionCandidateInput,
  TeamAttempt,
  TeamAttemptInput,
  TeamHub,
  TeamPromotionCandidate,
  TeamWinnerSelection,
} from './runtime.types.ts'

const ACTIVE_FRONTIER_STATUSES = new Set<TeamAttempt['status']>(['pending', 'running', 'succeeded'])

const sortAttempts = (attempts: TeamAttempt[]) =>
  [...attempts].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))

const createAttemptMap = (attempts: TeamAttempt[]) =>
  new Map(sortAttempts(attempts).map((attempt) => [attempt.id, attempt]))

const getTeamHubPaths = ({ memoryPath, teamId }: Pick<CreateTeamHubOptions, 'memoryPath' | 'teamId'>) => {
  const teamDir = join(memoryPath, 'teams', teamId)
  const attemptsDir = join(teamDir, 'attempts')
  const graphPath = join(teamDir, 'graph.json')
  const selectionsPath = join(teamDir, 'winner-selections.json')

  return { teamDir, attemptsDir, graphPath, selectionsPath }
}

const normalizeAttempt = ({
  teamId,
  attempt,
  now,
}: {
  teamId: string
  attempt: TeamAttemptInput
  now: () => Date
}): TeamAttempt => {
  const timestamp = now().toISOString()

  return TeamAttemptSchema.parse({
    ...attempt,
    teamId,
    createdAt: attempt.createdAt ?? timestamp,
    updatedAt: attempt.updatedAt ?? timestamp,
  })
}

const createGraphSnapshot = (teamId: string, attempts: TeamAttempt[]) =>
  TeamAttemptGraphSchema.parse({
    teamId,
    attempts: sortAttempts(attempts),
  })

const createWinnerSelectionHistorySnapshot = (teamId: string, selections: TeamWinnerSelection[]) =>
  TeamWinnerSelectionHistorySchema.parse({
    teamId,
    selections: [...selections].sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    ),
  })

const writeAttempt = async ({ attemptsDir, attempt }: { attemptsDir: string; attempt: TeamAttempt }) => {
  await Bun.write(join(attemptsDir, `${attempt.id}.json`), `${JSON.stringify(attempt, null, 2)}\n`)
}

const createPromotionCandidate = ({
  teamId,
  attempt,
  attempts,
}: {
  teamId: string
  attempt: TeamAttempt
  attempts: TeamAttempt[]
}): TeamPromotionCandidate => {
  const attemptMap = createAttemptMap(attempts)
  const childAttemptIds = attempts
    .filter((candidate) => candidate.parentAttemptId === attempt.id)
    .map((candidate) => candidate.id)
    .sort((left, right) => left.localeCompare(right))
  const descendantIds = new Set<string>()
  const lineage: TeamAttempt[] = []
  let current: TeamAttempt | undefined = attempt

  while (current) {
    lineage.push(current)
    current = current.parentAttemptId ? attemptMap.get(current.parentAttemptId) : undefined
  }

  const stack = [...childAttemptIds]

  while (stack.length > 0) {
    const nextId = stack.shift()
    if (!nextId || descendantIds.has(nextId)) continue
    descendantIds.add(nextId)
    for (const childId of attempts
      .filter((candidate) => candidate.parentAttemptId === nextId)
      .map((candidate) => candidate.id)
      .sort((left, right) => left.localeCompare(right))) {
      stack.push(childId)
    }
  }

  const succeededDescendantIds = [...descendantIds]
    .map((id) => attempts.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is TeamAttempt => Boolean(candidate && candidate.status === 'succeeded'))
    .map((candidate) => candidate.id)
    .sort((left, right) => left.localeCompare(right))

  return TeamPromotionCandidateSchema.parse({
    teamId,
    attemptId: attempt.id,
    attempt,
    lineage: lineage.reverse(),
    childAttemptIds,
    succeededDescendantIds,
    depth: Math.max(0, lineage.length - 1),
    isLeaf: childAttemptIds.length === 0,
  })
}

const listPromotionCandidatesFromAttempts = (teamId: string, attempts: TeamAttempt[]) =>
  attempts
    .filter((attempt) => attempt.status === 'succeeded')
    .map((attempt) =>
      createPromotionCandidate({
        teamId,
        attempt,
        attempts,
      }),
    )
    .filter((candidate) => candidate.succeededDescendantIds.length === 0)
    .sort(
      (left, right) =>
        left.attempt.createdAt.localeCompare(right.attempt.createdAt) || left.attemptId.localeCompare(right.attemptId),
    )

/**
 * Creates a persisted local TeamHub for attempt DAG metadata under `.memory/teams/<team-id>/`.
 *
 * @public
 */
export const createTeamHub = ({ teamId, memoryPath, now = () => new Date() }: CreateTeamHubOptions): TeamHub => {
  const { attemptsDir, graphPath, selectionsPath } = getTeamHubPaths({ teamId, memoryPath })
  let attempts = new Map<string, TeamAttempt>()
  let winnerSelections: TeamWinnerSelection[] = []

  const ensureDirectories = async () => {
    await mkdir(attemptsDir, { recursive: true })
  }

  const save = async () => {
    await ensureDirectories()
    const graph = createGraphSnapshot(teamId, [...attempts.values()])
    const selections = createWinnerSelectionHistorySnapshot(teamId, winnerSelections)
    await Bun.write(graphPath, `${JSON.stringify(graph, null, 2)}\n`)
    await Bun.write(selectionsPath, `${JSON.stringify(selections, null, 2)}\n`)
  }

  const load = async () => {
    await ensureDirectories()

    const nextAttempts: TeamAttempt[] = []
    const graphFile = Bun.file(graphPath)

    if (await graphFile.exists()) {
      const graph = TeamAttemptGraphSchema.parse(JSON.parse(await graphFile.text()))
      attempts = createAttemptMap(graph.attempts)
      const selectionsFile = Bun.file(selectionsPath)
      if (await selectionsFile.exists()) {
        const history = TeamWinnerSelectionHistorySchema.parse(JSON.parse(await selectionsFile.text()))
        winnerSelections = history.selections
      }
      return graph
    }

    const glob = new Bun.Glob('*.json')
    for await (const relativePath of glob.scan({ cwd: attemptsDir, absolute: false })) {
      const attempt = TeamAttemptSchema.parse(JSON.parse(await Bun.file(join(attemptsDir, relativePath)).text()))
      nextAttempts.push(attempt)
    }

    attempts = createAttemptMap(nextAttempts)
    const graph = createGraphSnapshot(teamId, nextAttempts)
    await Bun.write(graphPath, `${JSON.stringify(graph, null, 2)}\n`)
    const selections = createWinnerSelectionHistorySnapshot(teamId, winnerSelections)
    await Bun.write(selectionsPath, `${JSON.stringify(selections, null, 2)}\n`)
    return graph
  }

  const listAttempts = () => sortAttempts([...attempts.values()])

  const getAttempt = (attemptId: string) => attempts.get(attemptId)

  const getChildren = (attemptId: string) => listAttempts().filter((attempt) => attempt.parentAttemptId === attemptId)

  const getLeaves = () => {
    const parentIds = new Set(
      listAttempts().flatMap((attempt) => (attempt.parentAttemptId ? [attempt.parentAttemptId] : [])),
    )
    return listAttempts().filter((attempt) => !parentIds.has(attempt.id))
  }

  const getFrontier = () => getLeaves().filter((attempt) => ACTIVE_FRONTIER_STATUSES.has(attempt.status))

  const getLineage = (attemptId: string) => {
    const lineage: TeamAttempt[] = []
    let current = attempts.get(attemptId)

    while (current) {
      lineage.push(current)
      current = current.parentAttemptId ? attempts.get(current.parentAttemptId) : undefined
    }

    return lineage.reverse()
  }

  const listPromotionCandidates = () => listPromotionCandidatesFromAttempts(teamId, listAttempts())

  const getPromotionCandidate = (attemptId: string) =>
    listPromotionCandidates().find((candidate) => candidate.attemptId === attemptId)

  const listWinnerSelections = () =>
    [...winnerSelections].sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    )

  const getLatestWinnerSelection = () => listWinnerSelections().at(-1)

  const recordAttempt = async (attempt: TeamAttemptInput) => {
    const existing = attempts.get(attempt.id)
    const normalized = normalizeAttempt({
      teamId,
      attempt: {
        ...attempt,
        teamId,
        createdAt: attempt.createdAt ?? existing?.createdAt,
      },
      now,
    })

    if (normalized.parentAttemptId && !attempts.has(normalized.parentAttemptId)) {
      throw new Error(`Unknown parent attempt: ${normalized.parentAttemptId}`)
    }

    attempts.set(normalized.id, normalized)
    await ensureDirectories()
    await writeAttempt({ attemptsDir, attempt: normalized })
    await save()
    return normalized
  }

  const selectPromotionCandidate = async ({
    id,
    pmId,
    selectedAttemptId,
    candidateAttemptIds,
    rationale,
    metadata,
  }: SelectPromotionCandidateInput) => {
    const explicitCandidates = listPromotionCandidates()
    const eligibleAttemptIds = (candidateAttemptIds ?? explicitCandidates.map((candidate) => candidate.attemptId))
      .filter((attemptId, index, values) => values.indexOf(attemptId) === index)
      .sort((left, right) => left.localeCompare(right))

    if (eligibleAttemptIds.length === 0) {
      throw new Error(`No promotion candidates available for team ${teamId}`)
    }

    for (const attemptId of eligibleAttemptIds) {
      if (!explicitCandidates.some((candidate) => candidate.attemptId === attemptId)) {
        throw new Error(`Attempt ${attemptId} is not an explicit promotion candidate`)
      }
    }

    const selectedCandidate = explicitCandidates.find((candidate) => candidate.attemptId === selectedAttemptId)
    if (!selectedCandidate || !eligibleAttemptIds.includes(selectedAttemptId)) {
      throw new Error(`Attempt ${selectedAttemptId} is not an eligible promotion candidate`)
    }

    const selection = TeamWinnerSelectionSchema.parse({
      id: id ?? `winner:${teamId}:${winnerSelections.length + 1}`,
      teamId,
      pmId,
      selectedAttemptId,
      selectedLineageAttemptIds: selectedCandidate.lineage.map((attempt) => attempt.id),
      candidateAttemptIds: eligibleAttemptIds,
      rationale,
      createdAt: now().toISOString(),
      metadata,
    })

    winnerSelections = [...winnerSelections, selection]
    await save()
    return selection
  }

  return {
    teamId,
    memoryPath,
    load,
    save,
    recordAttempt,
    listAttempts,
    getAttempt,
    getChildren,
    getLeaves,
    getFrontier,
    getLineage,
    listPromotionCandidates,
    getPromotionCandidate,
    listWinnerSelections,
    getLatestWinnerSelection,
    selectPromotionCandidate,
  }
}
