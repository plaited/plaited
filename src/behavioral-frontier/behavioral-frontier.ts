import { isAbsolute, resolve } from 'node:path'
import type * as z from 'zod'

import type {
  BPEvent,
  CandidateBid,
  Frontier,
  FrontierSnapshot,
  PendingBid,
  ReplayToFrontierResult,
  RunningBid,
  SelectionSnapshot,
  SnapshotEvent,
  SnapshotMessage,
  Spec,
} from '../behavioral.ts'
import {
  advanceRunningToPending,
  computeFrontier,
  ensureArray,
  FRONTIER_STATUS,
  FrontierSnapshotSchema,
  isListeningFor,
  resumePendingThreadsForSelectedEvent,
  SNAPSHOT_MESSAGE_KINDS,
  SpecSchema,
  useSpec,
} from '../behavioral.ts'
import { makeCli } from '../cli/cli.ts'
import { deepEqual } from '../utils/deep-equal.ts'
import {
  BEHAVIORAL_FRONTIER_MODES,
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES,
  BEHAVIORAL_FRONTIER_STRATEGIES,
  BEHAVIORAL_FRONTIER_VERIFY_STATUSES,
} from './behavioral-frontier.constants.ts'
import {
  type BehavioralFrontierInput,
  BehavioralFrontierInputSchema,
  type BehavioralFrontierOutput,
  BehavioralFrontierOutputSchema,
} from './behavioral-frontier.schemas.ts'

const countSelectionSnapshots = ({ snapshotMessages }: { snapshotMessages: SnapshotMessage[] }) =>
  snapshotMessages.reduce((count, snapshot) => count + (snapshot.kind === 'selection' ? 1 : 0), 0)

const createFrontierSnapshot = ({ frontier, step }: { frontier: Frontier; step: number }): FrontierSnapshot =>
  FrontierSnapshotSchema.parse({
    kind: 'frontier',
    step,
    status: frontier.status,
    candidates: frontier.candidates.map((candidate) => ({
      priority: candidate.priority,
      type: candidate.type,
      ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
      ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
    })),
    enabled: frontier.enabled.map((candidate) => ({
      priority: candidate.priority,
      type: candidate.type,
      ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
      ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
    })),
  })

const createSelectionSnapshot = ({
  event,
  step,
}: {
  event: BPEvent & { ingress?: true }
  step: number
}): SelectionSnapshot => ({
  kind: SNAPSHOT_MESSAGE_KINDS.selection,
  step,
  selected: {
    type: event.type,
    ...(event.detail === undefined ? {} : { detail: event.detail }),
    ...(event.ingress === undefined ? {} : { ingress: event.ingress }),
  },
})

const createDeadlockSnapshot = ({ step }: { step: number }): SnapshotMessage => ({
  kind: SNAPSHOT_MESSAGE_KINDS.deadlock,
  step,
})

const matchesSelectedEvent = ({ candidate, selected }: { candidate: CandidateBid; selected: SnapshotEvent }) =>
  candidate.type === selected.type && deepEqual(candidate.detail, selected.detail)

const addIngressTriggerToPending = ({ pending, selected }: { pending: Set<PendingBid>; selected: SnapshotEvent }) => {
  const triggerThread = function* () {
    yield {
      request: {
        type: selected.type,
        ...(selected.detail === undefined ? {} : { detail: selected.detail }),
      },
    }
  }
  const generator = triggerThread()
  const yielded = generator.next()

  if (!yielded.done) {
    pending.add({
      priority: 0,
      generator,
      ingress: true,
      label: selected.type,
      ...yielded.value,
    })
  }
}

const getSelectedEvents = ({ snapshotMessages }: { snapshotMessages: SnapshotMessage[] }) =>
  snapshotMessages.flatMap((snapshot) =>
    snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection ? [snapshot.selected] : [],
  )

export const replayToFrontier = ({
  specs,
  snapshotMessages,
}: {
  specs: Spec[]
  snapshotMessages: SnapshotMessage[]
}): ReplayToFrontierResult => {
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()

  for (const [index, spec] of specs.entries()) {
    const [label, thread] = useSpec(spec)
    running.add({
      priority: index + 1,
      generator: thread(),
      label,
    })
  }

  advanceRunningToPending(running, pending)

  for (const [step, selected] of getSelectedEvents({ snapshotMessages }).entries()) {
    if (selected.ingress === true) {
      addIngressTriggerToPending({ pending, selected })
    }

    const frontier = computeFrontier({ pending })
    const enabled = [...frontier.enabled].sort((left, right) => left.priority - right.priority)
    const matched = enabled.find((candidate) => matchesSelectedEvent({ candidate, selected }))

    if (!matched) {
      throw new Error(`Selected event "${selected.type}" was not enabled at replay step ${step}.`)
    }

    const resumed = new Set<RunningBid>()
    resumePendingThreadsForSelectedEvent({
      running: resumed,
      pending,
      selectedEvent: matched,
    })
    advanceRunningToPending(resumed, pending)
  }

  return {
    pending,
    frontier: computeFrontier({ pending }),
  }
}

export type ExploreFrontiersArgs = {
  specs: Spec[]
  snapshotMessages?: SnapshotMessage[]
  triggers?: BPEvent[]
  strategy?: 'bfs' | 'dfs'
  selectionPolicy?: 'all-enabled' | 'scheduler'
  maxDepth?: number
}

export type FrontierTrace = {
  snapshotMessages: SnapshotMessage[]
}

export type DeadlockFinding = {
  code: 'deadlock'
  snapshotMessages: SnapshotMessage[]
}

export type ExploreFrontiersResult = {
  traces: FrontierTrace[]
  findings: DeadlockFinding[]
  report: {
    strategy: 'bfs' | 'dfs'
    selectionPolicy: 'all-enabled' | 'scheduler'
    visitedCount: number
    findingCount: number
    truncated: boolean
    maxDepth?: number
  }
}

export type VerifyFrontiersResult = {
  status:
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed
    | typeof BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated
  findings: DeadlockFinding[]
  report: ExploreFrontiersResult['report']
}

const triggerAffectsPendingBid = ({ pendingBid, trigger }: { pendingBid: PendingBid; trigger: BPEvent }) => {
  if (pendingBid.ingress === true) {
    return false
  }

  const candidate = {
    priority: 0,
    type: trigger.type,
    ...(trigger.detail === undefined ? {} : { detail: trigger.detail }),
    ingress: true as const,
  }

  return (
    (pendingBid.request !== undefined &&
      pendingBid.request.type === trigger.type &&
      deepEqual(pendingBid.request.detail, trigger.detail)) ||
    ensureArray(pendingBid.waitFor).some(isListeningFor(candidate)) ||
    ensureArray(pendingBid.interrupt).some(isListeningFor(candidate))
  )
}

const getRequestSuccessors = ({
  frontier,
  selectionPolicy,
  step,
}: {
  frontier: Frontier
  selectionPolicy: 'all-enabled' | 'scheduler'
  step: number
}) => {
  if (frontier.status !== FRONTIER_STATUS.ready) {
    return []
  }

  const enabled =
    selectionPolicy === BEHAVIORAL_FRONTIER_SELECTION_POLICIES.scheduler
      ? [...frontier.enabled].sort((left, right) => left.priority - right.priority).slice(0, 1)
      : frontier.enabled

  return enabled.map((candidate) =>
    createSelectionSnapshot({
      step,
      event: {
        type: candidate.type,
        ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
        ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
      },
    }),
  )
}

const getTriggerSuccessors = ({
  pending,
  snapshotMessages,
  specs,
  step,
  triggers,
}: {
  pending: Set<PendingBid>
  snapshotMessages: SnapshotMessage[]
  specs: Spec[]
  step: number
  triggers: BPEvent[]
}) => {
  const successors: SelectionSnapshot[] = []

  for (const trigger of triggers) {
    if (![...pending].some((pendingBid) => triggerAffectsPendingBid({ pendingBid, trigger }))) {
      continue
    }

    const selection = createSelectionSnapshot({
      step,
      event: {
        type: trigger.type,
        ...(trigger.detail === undefined ? {} : { detail: trigger.detail }),
        ingress: true,
      },
    })

    try {
      replayToFrontier({
        specs,
        snapshotMessages: [...snapshotMessages, selection],
      })
      successors.push(selection)
    } catch {}
  }

  return successors
}

export const exploreFrontiers = ({
  specs,
  snapshotMessages = [],
  triggers = [],
  strategy = BEHAVIORAL_FRONTIER_STRATEGIES.bfs,
  selectionPolicy = BEHAVIORAL_FRONTIER_SELECTION_POLICIES['all-enabled'],
  maxDepth,
}: ExploreFrontiersArgs): ExploreFrontiersResult => {
  if (strategy !== BEHAVIORAL_FRONTIER_STRATEGIES.bfs && strategy !== BEHAVIORAL_FRONTIER_STRATEGIES.dfs) {
    throw new Error(`Unsupported frontier exploration strategy "${String(strategy)}".`)
  }

  const pending = [snapshotMessages]
  const visited = new Set<string>()
  const traces: FrontierTrace[] = []
  const findings: DeadlockFinding[] = []
  let truncated = false

  while (pending.length > 0) {
    const current = strategy === BEHAVIORAL_FRONTIER_STRATEGIES.bfs ? pending.shift()! : pending.pop()!
    const key = JSON.stringify(current)

    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    const { frontier, pending: currentPending } = replayToFrontier({ specs, snapshotMessages: current })
    const step = countSelectionSnapshots({ snapshotMessages: current })
    const frontierSnapshot = createFrontierSnapshot({ frontier, step })

    traces.push({
      snapshotMessages: [...current, frontierSnapshot],
    })

    const requestSuccessors = getRequestSuccessors({
      frontier,
      selectionPolicy,
      step,
    })
    const triggerSuccessors = getTriggerSuccessors({
      pending: currentPending,
      snapshotMessages: current,
      specs,
      step,
      triggers,
    })
    const successors = [...requestSuccessors, ...triggerSuccessors]

    if (frontier.status === FRONTIER_STATUS.deadlock && triggerSuccessors.length === 0) {
      findings.push({
        code: 'deadlock',
        snapshotMessages: [...current, frontierSnapshot, createDeadlockSnapshot({ step })],
      })
    }

    if (maxDepth !== undefined && step >= maxDepth) {
      if (successors.length > 0) {
        truncated = true
      }
      continue
    }

    for (const successor of successors) {
      pending.push([...current, successor])
    }
  }

  return {
    traces,
    findings,
    report: {
      strategy,
      selectionPolicy,
      visitedCount: traces.length,
      findingCount: findings.length,
      truncated,
      ...(maxDepth === undefined ? {} : { maxDepth }),
    },
  }
}

export const verifyFrontiers = (args: ExploreFrontiersArgs): VerifyFrontiersResult => {
  const { findings, report } = exploreFrontiers(args)

  if (findings.length > 0) {
    return {
      status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed,
      findings,
      report,
    }
  }

  if (report.truncated) {
    return {
      status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated,
      findings,
      report,
    }
  }

  return {
    status: BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified,
    findings,
    report,
  }
}

const toAbsolutePath = ({ cwd, path }: { cwd?: string; path: string }) =>
  isAbsolute(path) ? path : resolve(cwd ? resolve(cwd) : process.cwd(), path)

const formatIssues = (issues: z.core.$ZodIssue[]) =>
  issues.map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`).join('; ')

const loadSpecsFromJsonl = async ({ cwd, specPath }: { cwd?: string; specPath: string }) => {
  const resolvedPath = toAbsolutePath({ cwd, path: specPath })
  const file = Bun.file(resolvedPath)

  if (!(await file.exists())) {
    throw new Error(`Spec file does not exist: ${resolvedPath}`)
  }

  const raw = await file.text()
  const specs: Spec[] = []

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }

    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(trimmed)
    } catch {
      throw new Error(`Invalid JSON on specPath line ${index + 1}: ${resolvedPath}`)
    }

    const parsedSpec = SpecSchema.safeParse(parsedJson)
    if (!parsedSpec.success) {
      throw new Error(`Invalid spec at ${resolvedPath}:${index + 1}: ${formatIssues(parsedSpec.error.issues)}`)
    }

    specs.push(parsedSpec.data)
  }

  return specs
}

const loadSpecs = async (input: BehavioralFrontierInput) =>
  'specs' in input ? input.specs : loadSpecsFromJsonl({ cwd: input.cwd, specPath: input.specPath })

const runReplay = async (
  input: Extract<BehavioralFrontierInput, { mode: 'replay' }>,
): Promise<BehavioralFrontierOutput> => {
  const specs = await loadSpecs(input)
  const snapshotMessages = input.snapshotMessages ?? []
  const { frontier } = replayToFrontier({
    specs,
    snapshotMessages,
  })

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.replay,
    snapshotMessages,
    frontier: createFrontierSnapshot({
      frontier,
      step: countSelectionSnapshots({ snapshotMessages }),
    }),
  }
}

const runExplore = async (
  input: Extract<BehavioralFrontierInput, { mode: 'explore' }>,
): Promise<BehavioralFrontierOutput> => {
  const specs = await loadSpecs(input)

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.explore,
    ...exploreFrontiers({
      specs,
      snapshotMessages: input.snapshotMessages,
      triggers: input.triggers,
      strategy: input.strategy,
      selectionPolicy: input.selectionPolicy,
      maxDepth: input.maxDepth,
    }),
  }
}

const runVerify = async (
  input: Extract<BehavioralFrontierInput, { mode: 'verify' }>,
): Promise<BehavioralFrontierOutput> => {
  const specs = await loadSpecs(input)

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.verify,
    ...verifyFrontiers({
      specs,
      snapshotMessages: input.snapshotMessages,
      triggers: input.triggers,
      strategy: input.strategy,
      selectionPolicy: input.selectionPolicy,
      maxDepth: input.maxDepth,
    }),
  }
}

export const runBehavioralFrontier = async (args: unknown): Promise<BehavioralFrontierOutput> => {
  const input = BehavioralFrontierInputSchema.parse(args)

  switch (input.mode) {
    case BEHAVIORAL_FRONTIER_MODES.replay:
      return BehavioralFrontierOutputSchema.parse(await runReplay(input))
    case BEHAVIORAL_FRONTIER_MODES.explore:
      return BehavioralFrontierOutputSchema.parse(await runExplore(input))
    case BEHAVIORAL_FRONTIER_MODES.verify:
      return BehavioralFrontierOutputSchema.parse(await runVerify(input))
  }
}

export const BEHAVIORAL_FRONTIER_COMMAND = 'behavioral-frontier'

export const behavioralFrontierCli = makeCli({
  name: BEHAVIORAL_FRONTIER_COMMAND,
  inputSchema: BehavioralFrontierInputSchema,
  outputSchema: BehavioralFrontierOutputSchema,
  help: [
    'Spec input options:',
    '  - specs: inline JSON array of behavioral specs',
    '  - specPath: JSONL file of behavioral specs (one spec object per line)',
    '',
    'Replay/explore/verify options:',
    '  - snapshotMessages: prior snapshot stream prefix',
    `  - strategy: ${BEHAVIORAL_FRONTIER_STRATEGIES.bfs} | ${BEHAVIORAL_FRONTIER_STRATEGIES.dfs}`,
    `  - selectionPolicy: ${BEHAVIORAL_FRONTIER_SELECTION_POLICIES['all-enabled']} | ${BEHAVIORAL_FRONTIER_SELECTION_POLICIES.scheduler}`,
    '  - triggers: external BPEvent values explored as ingress selections',
    '  - maxDepth: selection-depth cap for exploration',
  ].join('\n'),
  run: runBehavioralFrontier,
})
