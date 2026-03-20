import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { TeamAttemptGraphSchema, TeamAttemptSchema } from './runtime.schemas.ts'
import type { CreateTeamHubOptions, TeamAttempt, TeamAttemptInput, TeamHub } from './runtime.types.ts'

const ACTIVE_FRONTIER_STATUSES = new Set<TeamAttempt['status']>(['pending', 'running', 'succeeded'])

const sortAttempts = (attempts: TeamAttempt[]) =>
  [...attempts].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))

const createAttemptMap = (attempts: TeamAttempt[]) =>
  new Map(sortAttempts(attempts).map((attempt) => [attempt.id, attempt]))

const getTeamHubPaths = ({ memoryPath, teamId }: Pick<CreateTeamHubOptions, 'memoryPath' | 'teamId'>) => {
  const teamDir = join(memoryPath, 'teams', teamId)
  const attemptsDir = join(teamDir, 'attempts')
  const graphPath = join(teamDir, 'graph.json')

  return { teamDir, attemptsDir, graphPath }
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

const writeAttempt = async ({ attemptsDir, attempt }: { attemptsDir: string; attempt: TeamAttempt }) => {
  await Bun.write(join(attemptsDir, `${attempt.id}.json`), `${JSON.stringify(attempt, null, 2)}\n`)
}

/**
 * Creates a persisted local TeamHub for attempt DAG metadata under `.memory/teams/<team-id>/`.
 *
 * @public
 */
export const createTeamHub = ({ teamId, memoryPath, now = () => new Date() }: CreateTeamHubOptions): TeamHub => {
  const { attemptsDir, graphPath } = getTeamHubPaths({ teamId, memoryPath })
  let attempts = new Map<string, TeamAttempt>()

  const ensureDirectories = async () => {
    await mkdir(attemptsDir, { recursive: true })
  }

  const save = async () => {
    await ensureDirectories()
    const graph = createGraphSnapshot(teamId, [...attempts.values()])
    await Bun.write(graphPath, `${JSON.stringify(graph, null, 2)}\n`)
  }

  const load = async () => {
    await ensureDirectories()

    const nextAttempts: TeamAttempt[] = []
    const graphFile = Bun.file(graphPath)

    if (await graphFile.exists()) {
      const graph = TeamAttemptGraphSchema.parse(JSON.parse(await graphFile.text()))
      attempts = createAttemptMap(graph.attempts)
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
  }
}
