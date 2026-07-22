/**
 * Behavioral frontier analysis utilities for replaying, exploring, and verifying
 * behavioral thread frontiers.
 *
 * @remarks
 * These functions work with in-memory {@link Thread} arrays so extensions and agents
 * can analyze behavioral programs without file-IO or a running BP engine.
 *
 * ## Entry points
 *
 * - {@link replayToFrontier} — replay one concrete event-selection trace
 * - {@link exploreFrontiers} — enumerate reachable histories, find deadlocks
 * - {@link verifyFrontiers} — derive a pass/fail/truncated status from exploration
 *
 * ## Trace kind filters
 *
 * - {@link isSelectionTrace}
 * - {@link isFrontierTrace}
 * - {@link isDeadlockTrace}
 *
 * @packageDocumentation
 */

import * as z from 'zod'
import { FRONTIER_STATUS, TRACE_MESSAGE_KINDS } from './behavioral.constants.ts'
import {
  type BPEvent,
  type FrontierTrace,
  type RegisteredIdioms,
  type SelectionTrace,
  type Thread,
  type Trace,
  type TraceEvent,
  TraceSchema,
} from './behavioral.schemas.ts'
import type { CandidateBid, Frontier, PendingBid, ReplayToFrontierResult, RunningBid } from './behavioral.types.ts'
import {
  advanceRunningToPending,
  computeFrontier,
  generateRulesFunctions,
  isListeningFor,
  resumePendingThreadsForSelectedEvent,
  useThread,
} from './behavioral.utils.ts'

// ---------------------------------------------------------------------------
// Trace kind filter guards
// ---------------------------------------------------------------------------

/**
 * Narrow a {@link Trace} to a {@link SelectionTrace}.
 *
 * @public
 */
export const isSelectionTrace = (msg: Trace): msg is SelectionTrace => msg.kind === TRACE_MESSAGE_KINDS.selection

/**
 * Narrow a {@link Trace} to a {@link FrontierTrace}.
 *
 * @public
 */
export const isFrontierTrace = (msg: Trace): msg is FrontierTrace => msg.kind === TRACE_MESSAGE_KINDS.frontier

/**
 * Narrow a {@link Trace} to a deadlock trace.
 *
 * @public
 */
export const isDeadlockTrace = (msg: Trace): msg is Extract<Trace, { kind: typeof TRACE_MESSAGE_KINDS.deadlock }> =>
  msg.kind === TRACE_MESSAGE_KINDS.deadlock

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const countSelectionTraces = ({ messages }: { messages: Trace[] }) =>
  messages.reduce((count, msg) => count + (msg.kind === 'selection' ? 1 : 0), 0)

const createFrontierTrace = ({ frontier, step }: { frontier: Frontier; step: number }): FrontierTrace => ({
  kind: 'frontier',
  timestamp: Date.now(),
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

const createSelectionTrace = ({
  event,
  step,
}: {
  event: BPEvent & { ingress?: true }
  step: number
}): SelectionTrace => ({
  kind: TRACE_MESSAGE_KINDS.selection,
  timestamp: Date.now(),
  step,
  selected: {
    type: event.type,
    ...(event.detail === undefined ? {} : { detail: event.detail }),
    ...(event.ingress === undefined ? {} : { ingress: event.ingress }),
    ...(event.topic === undefined ? {} : { topic: event.topic }),
  },
})

const createDeadlockTrace = ({ step }: { step: number }): Trace => ({
  kind: TRACE_MESSAGE_KINDS.deadlock,
  timestamp: Date.now(),
  step,
})

const matchesSelectedEvent = ({ candidate, selected }: { candidate: CandidateBid; selected: TraceEvent }) =>
  candidate.type === selected.type &&
  candidate.topic === selected.topic &&
  Bun.deepEquals(candidate.detail, selected.detail)

const addIngressTriggerToPending = ({ pending, selected }: { pending: Set<PendingBid>; selected: TraceEvent }) => {
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

const getSelectedEvents = ({ messages }: { messages: Trace[] }) =>
  messages.flatMap((msg) => (msg.kind === TRACE_MESSAGE_KINDS.selection ? [msg.selected] : []))

/**
 * Compiles an array of {@link Thread} tuples into the generator representations
 * needed by the frontier engine.
 *
 * @param threads - Thread tuples authored as `['label', { rules, once? }]`.
 * @param topic - Optional topic stamp to pass into {@link generateRulesFunctions}.
 * @returns Compiled entries each with the authored `label` and a started generator.
 */
const compileThreads = (
  threads: Thread[],
  topic?: string,
): Array<{ label: string; generator: IterableIterator<RegisteredIdioms> }> =>
  threads.map(([label, { rules, once }]) => ({
    label,
    generator: useThread(generateRulesFunctions(rules, topic), once)(),
  }))

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Arguments for {@link exploreFrontiers} and {@link verifyFrontiers}.
 *
 * @public
 */
export type ExploreFrontiersArgs = {
  /** Thread tuples to analyze. */
  threads: Thread[]
  /** Prior trace prefix to replay before exploring. */
  messages?: Trace[]
  /** External trigger events that may wake pending threads. */
  triggers?: BPEvent[]
  /** Exploration strategy: `'bfs'` (breadth-first) or `'dfs'` (depth-first). Default: `'bfs'`. */
  strategy?: 'bfs' | 'dfs'
  /** How to select among enabled candidates: `'all-enabled'` (all branches) or `'scheduler'` (priority order, one at a time). Default: `'all-enabled'`. */
  selectionPolicy?: 'all-enabled' | 'scheduler'
  /** Maximum selection depth before truncating exploration. */
  maxDepth?: number
  /** Topic stamp applied to all thread rules. */
  topic?: string
}

/**
 * One explored history: trace messages including the final frontier.
 *
 * @public
 */
export type TraceRecord = {
  messages: Trace[]
}

/**
 * A deadlock finding discovered during exploration.
 *
 * @public
 */
export type DeadlockFinding = {
  code: 'deadlock'
  messages: Trace[]
}

/**
 * Result of an {@link exploreFrontiers} call.
 *
 * @public
 */
export type ExploreFrontiersResult = {
  traces: TraceRecord[]
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

/**
 * Result of a {@link verifyFrontiers} call.
 *
 * @public
 */
export type VerifyFrontiersResult = {
  status: 'verified' | 'failed' | 'truncated'
  findings: DeadlockFinding[]
  report: ExploreFrontiersResult['report']
}

/**
 * Replays a concrete sequence of selection trace messages against a thread
 * set and returns the resulting frontier.
 *
 * @param args.threads - Thread tuples to replay.
 * @param args.messages - Selection trace to replay. Each selection is
 *   checked for enablement at the corresponding step.
 * @param args.topic - Optional topic stamp applied to all thread rules.
 * @returns The replay result containing the pending set and final frontier.
 *
 * @throws If a selection event is not enabled at its replay step.
 *
 * @public
 */
export const replayToFrontier = ({
  threads,
  messages = [],
  topic,
}: {
  threads: Thread[]
  messages?: Trace[]
  topic?: string
}): ReplayToFrontierResult => {
  const pending = new Set<PendingBid>()
  const running = new Set<RunningBid>()

  const entries = compileThreads(threads, topic)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    running.add({
      priority: i + 1,
      generator: entry.generator,
      label: entry.label,
    })
  }

  advanceRunningToPending(running, pending)

  for (const [step, selected] of getSelectedEvents({ messages }).entries()) {
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

// ---------------------------------------------------------------------------
// Internal exploration helpers
// ---------------------------------------------------------------------------

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
      Bun.deepEquals(pendingBid.request.detail, trigger.detail)) ||
    pendingBid.waitFor?.some(isListeningFor(candidate)) ||
    pendingBid.interrupt?.some(isListeningFor(candidate))
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
    selectionPolicy === 'scheduler'
      ? [...frontier.enabled].sort((left, right) => left.priority - right.priority).slice(0, 1)
      : frontier.enabled

  return enabled.map((candidate) =>
    createSelectionTrace({
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
  messages,
  threads,
  step,
  triggers,
  topic,
}: {
  pending: Set<PendingBid>
  messages: Trace[]
  threads: Thread[]
  step: number
  triggers: BPEvent[]
  topic?: string
}) => {
  const successors: SelectionTrace[] = []

  for (const trigger of triggers) {
    if (![...pending].some((pendingBid) => triggerAffectsPendingBid({ pendingBid, trigger }))) {
      continue
    }

    const selection = createSelectionTrace({
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
        messages: [...messages, selection],
        topic,
      })
      successors.push(selection)
    } catch {
      // selection not valid for this frontier — skip
    }
  }

  return successors
}

// ---------------------------------------------------------------------------
// Private self-validation schemas for explore/verify return shapes
// ---------------------------------------------------------------------------

const DeadlockFindingSchema = z.strictObject({
  code: z.literal('deadlock'),
  messages: TraceSchema.array(),
})

const TraceRecordSchema = z.strictObject({
  messages: TraceSchema.array(),
})

const ExploreReportSchema = z.strictObject({
  strategy: z.enum(['bfs', 'dfs']),
  selectionPolicy: z.enum(['all-enabled', 'scheduler']),
  visitedCount: z.number().int().nonnegative(),
  findingCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  maxDepth: z.number().int().nonnegative().optional(),
})

const ExploreResultSchema = z.strictObject({
  traces: z.array(TraceRecordSchema),
  findings: z.array(DeadlockFindingSchema),
  report: ExploreReportSchema,
})

const VerifyResultSchema = z.strictObject({
  status: z.enum(['verified', 'failed', 'truncated']),
  findings: z.array(DeadlockFindingSchema),
  report: ExploreReportSchema,
})

/**
 * Explores reachable frontiers from an initial trace prefix, collecting
 * traces and deadlock findings.
 *
 * @param args - {@link ExploreFrontiersArgs}
 * @returns {@link ExploreFrontiersResult}
 *
 * @public
 */
export const exploreFrontiers = ({
  threads,
  messages = [],
  triggers = [],
  strategy = 'bfs',
  selectionPolicy = 'all-enabled',
  maxDepth,
  topic,
}: ExploreFrontiersArgs): ExploreFrontiersResult => {
  if (strategy !== 'bfs' && strategy !== 'dfs') {
    throw new Error(`Unsupported frontier exploration strategy "${String(strategy)}".`)
  }

  const pending = [messages]
  const visited = new Set<string>()
  const traces: TraceRecord[] = []
  const findings: DeadlockFinding[] = []
  let truncated = false

  while (pending.length > 0) {
    const current = strategy === 'bfs' ? pending.shift()! : pending.pop()!
    const key = JSON.stringify(current)

    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    const { frontier, pending: currentPending } = replayToFrontier({ threads, messages: current, topic })
    const step = countSelectionTraces({ messages: current })
    const frontierTrace = createFrontierTrace({ frontier, step })

    traces.push({
      messages: [...current, frontierTrace],
    })

    const requestSuccessors = getRequestSuccessors({
      frontier,
      selectionPolicy,
      step,
    })
    const triggerSuccessors = getTriggerSuccessors({
      pending: currentPending,
      messages: current,
      threads,
      step,
      triggers,
      topic,
    })
    const successors = [...requestSuccessors, ...triggerSuccessors]

    if (frontier.status === FRONTIER_STATUS.deadlock && triggerSuccessors.length === 0) {
      findings.push({
        code: 'deadlock',
        messages: [...current, frontierTrace, createDeadlockTrace({ step })],
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

  return ExploreResultSchema.parse({
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
  })
}

/**
 * Verifies a thread set by exploring its frontiers and deriving a
 * pass/fail/truncated status.
 *
 * @param args - {@link ExploreFrontiersArgs}
 * @returns {@link VerifyFrontiersResult}
 *
 * @public
 */
export const verifyFrontiers = (args: ExploreFrontiersArgs): VerifyFrontiersResult => {
  const { findings, report } = exploreFrontiers(args)

  if (findings.length > 0) {
    return VerifyResultSchema.parse({
      status: 'failed',
      findings,
      report,
    })
  }

  if (report.truncated) {
    return VerifyResultSchema.parse({
      status: 'truncated',
      findings,
      report,
    })
  }

  return VerifyResultSchema.parse({
    status: 'verified',
    findings,
    report,
  })
}
