/**
 * Behavioral frontier analysis CLI for replaying, exploring, and verifying
 * behavioral thread files.
 *
 * @internal
 */

import { isAbsolute, resolve } from 'node:path'
import * as z from 'zod'
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
  Thread,
} from '../behavioral.ts'
import {
  advanceRunningToPending,
  BPEventSchema,
  computeFrontier,
  ensureArray,
  FRONTIER_STATUS,
  FrontierSnapshotSchema,
  isListeningFor,
  isThread,
  resumePendingThreadsForSelectedEvent,
  SNAPSHOT_MESSAGE_KINDS,
  SnapshotMessageSchema,
} from '../behavioral.ts'
import { deepEqual, keyMirror } from '../utils.ts'
import { makeCli } from './cli.ts'

const BEHAVIORAL_FRONTIER_MODES = keyMirror('replay', 'explore', 'verify')

const BEHAVIORAL_FRONTIER_STRATEGIES = keyMirror('bfs', 'dfs')

const BEHAVIORAL_FRONTIER_SELECTION_POLICIES = keyMirror('all-enabled', 'scheduler')

const BEHAVIORAL_FRONTIER_VERIFY_STATUSES = keyMirror('verified', 'failed', 'truncated')

const StrategySchema = z.enum([BEHAVIORAL_FRONTIER_STRATEGIES.bfs, BEHAVIORAL_FRONTIER_STRATEGIES.dfs])

const SelectionPolicySchema = z.enum([
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES['all-enabled'],
  BEHAVIORAL_FRONTIER_SELECTION_POLICIES.scheduler,
])

const SnapshotMessagesSchema = z.array(SnapshotMessageSchema)

const ExploreOptionsShape = {
  snapshotMessages: SnapshotMessagesSchema.optional(),
  triggers: z.array(BPEventSchema).optional(),
  strategy: StrategySchema.optional(),
  selectionPolicy: SelectionPolicySchema.optional(),
  maxDepth: z.number().int().nonnegative().optional(),
}

const ReplayInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.replay),
  threads: z.array(z.string()),
  cwd: z.string().optional(),
  snapshotMessages: SnapshotMessagesSchema.optional(),
})

const ExploreInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.explore),
  threads: z.array(z.string()),
  cwd: z.string().optional(),
  ...ExploreOptionsShape,
})

const VerifyInputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.verify),
  threads: z.array(z.string()),
  cwd: z.string().optional(),
  ...ExploreOptionsShape,
})

const BehavioralFrontierInputSchema = z
  .discriminatedUnion('mode', [ReplayInputSchema, ExploreInputSchema, VerifyInputSchema])
  .describe('Replay, explore, or verify behavioral frontiers from snapshotMessages plus thread file paths.')

type BehavioralFrontierInput = z.infer<typeof BehavioralFrontierInputSchema>

const FrontierTraceSchema = z.strictObject({
  snapshotMessages: SnapshotMessagesSchema,
})

const DeadlockFindingSchema = z.strictObject({
  code: z.literal('deadlock'),
  snapshotMessages: SnapshotMessagesSchema,
})

const ExploreReportSchema = z.strictObject({
  strategy: StrategySchema,
  selectionPolicy: SelectionPolicySchema,
  visitedCount: z.number().int().nonnegative(),
  findingCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  maxDepth: z.number().int().nonnegative().optional(),
})

const ReplayOutputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.replay),
  snapshotMessages: SnapshotMessagesSchema,
  frontier: FrontierSnapshotSchema,
})

const ExploreOutputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.explore),
  traces: z.array(FrontierTraceSchema),
  findings: z.array(DeadlockFindingSchema),
  report: ExploreReportSchema,
})

const VerifyOutputSchema = z.strictObject({
  mode: z.literal(BEHAVIORAL_FRONTIER_MODES.verify),
  status: z.enum([
    BEHAVIORAL_FRONTIER_VERIFY_STATUSES.verified,
    BEHAVIORAL_FRONTIER_VERIFY_STATUSES.failed,
    BEHAVIORAL_FRONTIER_VERIFY_STATUSES.truncated,
  ]),
  findings: z.array(DeadlockFindingSchema),
  report: ExploreReportSchema,
})

const BehavioralFrontierOutputSchema = z
  .discriminatedUnion('mode', [ReplayOutputSchema, ExploreOutputSchema, VerifyOutputSchema])
  .describe('Direct behavioral-frontier output shapes.')

type BehavioralFrontierOutput = z.infer<typeof BehavioralFrontierOutputSchema>

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
      ...(candidate.topic === undefined ? {} : { topic: candidate.topic }),
    })),
    enabled: frontier.enabled.map((candidate) => ({
      priority: candidate.priority,
      type: candidate.type,
      ...(candidate.detail === undefined ? {} : { detail: candidate.detail }),
      ...(candidate.ingress === undefined ? {} : { ingress: candidate.ingress }),
      ...(candidate.topic === undefined ? {} : { topic: candidate.topic }),
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
    ...(event.topic === undefined ? {} : { topic: event.topic }),
  },
})

const createDeadlockSnapshot = ({ step }: { step: number }): SnapshotMessage => ({
  kind: SNAPSHOT_MESSAGE_KINDS.deadlock,
  step,
})

const matchesSelectedEvent = ({ candidate, selected }: { candidate: CandidateBid; selected: SnapshotEvent }) =>
  candidate.type === selected.type && candidate.topic === selected.topic && deepEqual(candidate.detail, selected.detail)

const addIngressTriggerToPending = ({ pending, selected }: { pending: Set<PendingBid>; selected: SnapshotEvent }) => {
  const triggerThread = function* () {
    yield {
      request: {
        type: selected.type,
        ...(selected.detail === undefined ? {} : { detail: selected.detail }),
        ...(selected.topic === undefined ? {} : { topic: selected.topic }),
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

type ThreadEntry = [string, ReturnType<Thread>]

export const replayToFrontier = ({
  threads,
  snapshotMessages,
}: {
  threads: ThreadEntry[]
  snapshotMessages: SnapshotMessage[]
}): ReplayToFrontierResult => {
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()

  for (const [index, [label, threadFn]] of threads.entries()) {
    running.add({
      priority: index + 1,
      generator: threadFn(),
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
  threads: ThreadEntry[]
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
    ...(trigger.topic === undefined ? {} : { topic: trigger.topic }),
    ingress: true as const,
  }

  return (
    (pendingBid.request !== undefined &&
      pendingBid.request.type === trigger.type &&
      pendingBid.request.topic === trigger.topic &&
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
        ...(candidate.topic === undefined ? {} : { topic: candidate.topic }),
      },
    }),
  )
}

const getTriggerSuccessors = ({
  pending,
  snapshotMessages,
  threads,
  step,
  triggers,
}: {
  pending: Set<PendingBid>
  snapshotMessages: SnapshotMessage[]
  threads: ThreadEntry[]
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
        ...(trigger.topic === undefined ? {} : { topic: trigger.topic }),
        ingress: true,
      },
    })

    try {
      replayToFrontier({
        threads,
        snapshotMessages: [...snapshotMessages, selection],
      })
      successors.push(selection)
    } catch {}
  }

  return successors
}

export const exploreFrontiers = ({
  threads,
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

    const { frontier, pending: currentPending } = replayToFrontier({ threads, snapshotMessages: current })
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
      threads,
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

const loadThreads = async ({ cwd, paths }: { cwd?: string; paths: string[] }): Promise<ThreadEntry[]> => {
  const threadEntries: ThreadEntry[] = []

  for (const threadPath of paths) {
    const resolvedPath = toAbsolutePath({ cwd, path: threadPath })
    const file = Bun.file(resolvedPath)

    if (!(await file.exists())) {
      throw new Error(`Thread file does not exist: ${resolvedPath}`)
    }

    const mod = await import(resolvedPath)

    for (const [key, exportValue] of Object.entries(mod)) {
      if (isThread(exportValue)) {
        threadEntries.push([key, exportValue])
      }
    }
  }

  return threadEntries
}

const assertThreadsNotEmpty = (threads: ThreadEntry[]) => {
  if (threads.length === 0) {
    throw new Error('No behavioral thread exports found in the provided thread files.')
  }
}

const runReplay = async (
  input: Extract<BehavioralFrontierInput, { mode: 'replay' }>,
): Promise<BehavioralFrontierOutput> => {
  const threads = await loadThreads({ cwd: input.cwd, paths: input.threads })
  assertThreadsNotEmpty(threads)
  const snapshotMessages = input.snapshotMessages ?? []
  const { frontier } = replayToFrontier({
    threads,
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
  const threads = await loadThreads({ cwd: input.cwd, paths: input.threads })
  assertThreadsNotEmpty(threads)

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.explore,
    ...exploreFrontiers({
      threads,
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
  const threads = await loadThreads({ cwd: input.cwd, paths: input.threads })
  assertThreadsNotEmpty(threads)

  return {
    mode: BEHAVIORAL_FRONTIER_MODES.verify,
    ...verifyFrontiers({
      threads,
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

export const FRONTIER_ANALYSIS_COMMAND = 'frontier-analysis'

export const frontierAnalysisCli = makeCli({
  name: FRONTIER_ANALYSIS_COMMAND,
  inputSchema: BehavioralFrontierInputSchema,
  outputSchema: BehavioralFrontierOutputSchema,
  help: [
    'Thread input options:',
    '  - threads: array of paths to behavioral thread files',
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
