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

import { ueid } from '../utils.ts'
import { FRONTIER_STATUS, TRACE_MESSAGE_KINDS } from './behavioral.constants.ts'
import type {
  BPEvent,
  FrontierTrace,
  RegisteredBPListener,
  RegisteredIdioms,
  RegisteredTransformListener,
  SelectionTrace,
  Thread,
  Trace,
  TraceEvent,
} from './behavioral.schemas.ts'
import type { CandidateBid, Frontier, PendingBid, ReplayToFrontierResult, RunningBid } from './behavioral.types.ts'
import {
  advanceRunningToPending,
  computeFrontier,
  generateRulesFunctions,
  isListeningFor,
  isTransformListener,
  resumePendingThreadsForSelectedEvent,
  serializeRegisteredListener,
  serializeTransformListener,
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

const createFrontierTrace = ({
  frontier,
  step,
  instanceId,
}: {
  frontier: Frontier
  step: number
  instanceId: string
}): FrontierTrace => ({
  kind: 'frontier',
  timestamp: Date.now(),
  instanceId,
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
  instanceId,
}: {
  event: BPEvent & { ingress?: true }
  step: number
  instanceId: string
}): SelectionTrace => ({
  kind: TRACE_MESSAGE_KINDS.selection,
  timestamp: Date.now(),
  instanceId,
  step,
  selected: {
    type: event.type,
    ...(event.detail === undefined ? {} : { detail: event.detail }),
    ...(event.ingress === undefined ? {} : { ingress: event.ingress }),
    ...(event.topic === undefined ? {} : { topic: event.topic }),
  },
})

const createDeadlockTrace = ({ step, instanceId }: { step: number; instanceId: string }): Trace => ({
  kind: TRACE_MESSAGE_KINDS.deadlock,
  timestamp: Date.now(),
  instanceId,
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
  threads.map(({ label, rules, once }) => ({
    label,
    generator: useThread(generateRulesFunctions(rules, topic), once)(),
  }))

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
 * Replays a concrete sequence of selection trace messages against a thread
 * set and returns the resulting frontier.
 *
 * @param args.threads - Thread tuples to replay.
 * @param args.messages - Selection trace to replay. Each selection is
 *   checked for enablement at the corresponding step.
 * @param args.topic - Optional topic stamp applied to all thread rules.
 * @param args.instanceId - Instance id stamped on synthetic interrupt/transform
 *   traces emitted during resumption. Defaults to a minted `ueid('bp_')`.
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
  instanceId = ueid('bp_'),
}: {
  threads: Thread[]
  messages?: Trace[]
  topic?: string
  instanceId?: string
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
      instanceId,
      step,
    })
    advanceRunningToPending(resumed, pending)
  }

  return {
    pending,
    frontier: computeFrontier({ pending }),
  }
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
      Bun.deepEquals(pendingBid.request.detail, trigger.detail)) ||
    pendingBid.waitFor?.some(isListeningFor(candidate)) ||
    pendingBid.interrupt?.some(isListeningFor(candidate)) ||
    pendingBid.transform?.some(isListeningFor(candidate))
  )
}

const getRequestSuccessors = ({
  frontier,
  selectionPolicy,
  step,
  instanceId,
}: {
  frontier: Frontier
  selectionPolicy: 'all-enabled' | 'scheduler'
  step: number
  instanceId: string
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
      instanceId,
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
  instanceId,
}: {
  pending: Set<PendingBid>
  messages: Trace[]
  threads: Thread[]
  step: number
  triggers: BPEvent[]
  topic?: string
  instanceId: string
}) => {
  const successors: SelectionTrace[] = []

  for (const trigger of triggers) {
    if (![...pending].some((pendingBid) => triggerAffectsPendingBid({ pendingBid, trigger }))) {
      continue
    }

    const selection = createSelectionTrace({
      step,
      instanceId,
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
        instanceId,
      })
      successors.push(selection)
    } catch {
      // selection not valid for this frontier — skip
    }
  }

  return successors
}

/**
 * @internal
 * Canonicalizes a listener set into a content-sorted array of JSON strings.
 *
 * Each listener (`waitFor`/`block`/`interrupt`/`transform`) is projected to its
 * JSON-only form — the zod `detailSchema` instance is converted to JSON Schema
 * — and serialized. The resulting strings are sorted so two listener sets that
 * differ only by declaration order produce the same array. This is what lets
 * {@link frontierStateKey} treat structurally-equal pending sets as the same
 * state.
 *
 * @param listener - Listeners to canonicalize.
 * @returns A sorted array of JSON strings, one per projected listener.
 */
const normalizeListeners = (listener: RegisteredBPListener[] | RegisteredTransformListener[]) =>
  listener
    .map((l) => JSON.stringify(isTransformListener(l) ? serializeTransformListener(l) : serializeRegisteredListener(l)))
    .sort()

/**
 * Derive a canonical string key for a BP pending set.
 *
 * Two pending sets collapse to the same key when they are structurally
 * identical — same threads parked at the same sync points, yielding the same
 * idioms with the same constraints — regardless of bid insertion order or the
 * identity of the underlying generator closures. This is the abstraction that
 * lets `exploreFrontiers` close the state graph for looping programs instead
 * of chasing ever-growing traces.
 *
 * @remarks
 * - Drops instance-identity and non-serializable artifacts: the `generator`
 *   closure and each listener's zod `detailSchema` instance (serialized to
 *   JSON Schema in its place).
 * - `request` is projected to `{ type, detail, topic }`. Bid order and listener
 *   order are canonicalized by sorting on serialized content, yielding a total
 *   order independent of input order.
 *
 * MINIMAL: relies on object-key insertion order being stable across paths
 * (true while `advanceRunningToPending` constructs bids consistently). A
 * reordered-keys `detail`/`detailSchema` would produce a different key for a
 * semantically-equal state. Upgrade path: swap `JSON.stringify` for a
 * recursive canonical-JSON serializer (an in-progress `canonicalJsonStringify`
 * is referenced by `src/utils/tests/canonical-json.spec.ts`).
 *
 * @param pending - The pending bid set to canonicalize.
 * @returns A stable string key; equal keys imply structurally-equal states.
 *
 * @public
 */
export const frontierStateKey = ({ pending }: { pending: Set<PendingBid> }): string =>
  JSON.stringify(
    [...pending]
      .map(({ waitFor, block, interrupt, request, transform, generator: _gen, ...rest }) =>
        JSON.stringify({
          ...rest,
          // request is field-picked to { type, detail, topic } so non-trace
          // fields never enter the state key (frontier-analysis invariant).
          ...(request && {
            request: {
              topic: request.topic,
              type: request.type,
              ...(request.detail === undefined ? {} : { detail: request.detail }),
            },
          }),
          ...(waitFor && { waitFor: normalizeListeners(waitFor) }),
          ...(block && { block: normalizeListeners(block) }),
          ...(interrupt && { interrupt: normalizeListeners(interrupt) }),
          ...(transform && { transform: normalizeListeners(transform) }),
        }),
      )
      .sort(),
  )

export type StateNode = {
  stateKey: string
  /** The frontier at this state; Step 3 reads enabled/candidates here. */
  frontier: Frontier
  /** Selection depth at first discovery (BFS-shortest under bfs; arbitrary under dfs). */
  step: number
  /** Labeled outgoing edges: the event selected to reach each successor state. */
  successors: Array<{ selection: TraceEvent; to: string }>
}

/**
 * An SCC is a cycle iff it has more than one node, or a single node with a
 * self-edge. Single-node SCCs without a self-edge are DAG leaves, not cycles.
 *
 * @param scc - One strongly connected component (array of state keys).
 * @param graph - The graph the SCC came from, used to detect self-edges.
 * @returns `true` when the SCC represents a reachable cycle.
 *
 * @public
 */
export const isCycle = (scc: string[], graph: Map<string, StateNode>): boolean =>
  scc.length > 1 || (scc.length === 1 && graph.get(scc[0]!)!.successors.some((e) => e.to === scc[0]!))

/**
 * Partition a labeled state graph into its strongly connected components via
 * iterative Tarjan.
 *
 * Returns EVERY SCC, including trivial single-node components that are not
 * cycles (a DAG yields one trivial SCC per node). Cycle interpretation is a
 * separate concern handled by {@link isCycle}; this finder deliberately does
 * not filter, so callers can inspect raw component structure and so the SCC
 * algorithm stays independently testable.
 *
 * @remarks
 * Iterative (explicit work stack) rather than recursive, so a large single
 * cycle does not overflow the JS stack. Depends only on node adjacency
 * (`successors: Array<{ to }>`), so it accepts the state graph built by
 * `exploreFrontiers` as well as hand-constructed fake graphs for testing.
 *
 * @param graph - Graph keyed by state key; each node carries its successor edges.
 * @returns One array per SCC, each containing the state keys in that component.
 *
 * @public
 */
export const findStronglyConnectedComponents = (graph: Map<string, StateNode>): string[][] => {
  let index = 0
  const indices = new Map<string, number>()
  const lowlinks = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const sccs: string[][] = []
  const work: { node: string; cursor: number }[] = [] // explicit recursion stack

  for (const root of graph.keys()) {
    if (indices.has(root)) continue // already processed by an earlier DFS

    // DISCOVER root: assign index, lowlink, push onto SCC stack, push work frame
    indices.set(root, index)
    lowlinks.set(root, index)
    onStack.add(root)
    stack.push(root)
    work.push({ node: root, cursor: 0 })

    index++
    while (work.length > 0) {
      const frame = work[work.length - 1]! // peek, don't pop yet
      const succ = graph.get(frame.node)!.successors

      if (frame.cursor < succ.length) {
        const w = succ[frame.cursor]!.to
        frame.cursor++

        if (!indices.has(w)) {
          // Case 1: descend. (cursor already advanced)
          indices.set(w, index)
          lowlinks.set(w, index)
          index++
          onStack.add(w)
          stack.push(w)
          work.push({ node: w, cursor: 0 })
        } else if (onStack.has(w)) {
          // Case 2: back-edge to an ancestor — use INDEX (this rule is now only
          // ever reached for genuine back-edges, never for child-returns, because
          // child-returns no longer revisit the edge).
          lowlinks.set(frame.node, Math.min(lowlinks.get(frame.node)!, indices.get(w)!))
        }
        continue
      }

      // CURSOR EXHAUSTED
      if (lowlinks.get(frame.node) === indices.get(frame.node)) {
        const scc: string[] = []
        let w: string
        do {
          w = stack.pop()!
          onStack.delete(w)
          scc.push(w)
        } while (w !== frame.node)
        sccs.push(scc)
      }
      work.pop()

      // ← CHILD-RETURN PROPAGATION: the frame we just popped is a child of the new
      // top frame. Propagate the child's LOWLINK (not its index) into the parent.
      if (work.length > 0) {
        const parent = work[work.length - 1]!
        lowlinks.set(parent.node, Math.min(lowlinks.get(parent.node)!, lowlinks.get(frame.node)!))
      }
    }
  }
  return sccs
}

/**
 * A livelock finding: a reachable cycle in which no progress event is ever
 * selected. The program can spin forever inside the cycle without
 * accomplishing anything the caller declared meaningful.
 *
 * @remarks
 * `states` is the set of state keys in the cycle (a strongly connected
 * component). `progressTypes` records the caller-supplied progress set, so a
 * consumer replaying or reporting the finding knows what was being checked.
 *
 * @public
 */
export type LivelockFinding = {
  code: 'livelock'
  states: string[]
  progressTypes: string[]
}

/**
 * Detect livelocks in a labeled state graph.
 *
 * A livelock is a cycle (per {@link isCycle}) in which no edge is labeled by a
 * progress event. "Progress" is whatever the caller declares meaningful — this
 * is the specification pillar: the caller supplies the property, and this
 * function checks that every reachable cycle selects at least one progress
 * event. A cycle that never does can spin forever without accomplishing
 * anything.
 *
 * @remarks
 * Only edges whose endpoints both lie in the SCC count toward progress — an
 * edge that *leaves* the cycle is an escape, not progress made *inside* the
 * cycle, and is not credited. This is the non-obvious correctness condition:
 * escapes don't redeem a livelock.
 *
 * `sccs` is expected to come from {@link findStronglyConnectedComponents} over
 * the same `graph`.
 *
 * @param args.graph - The labeled state graph (as built by `exploreFrontiers`).
 * @param args.sccs - Strongly connected components of `graph`.
 * @param args.progress - Event types that count as progress (the specification).
 * @returns One {@link LivelockFinding} per cycle that never selects a progress event.
 *
 * @public
 */
export const findLivelocks = ({
  graph,
  sccs,
  progress,
}: {
  graph: Map<string, StateNode>
  sccs: string[][]
  progress: string[]
}): LivelockFinding[] => {
  const findings: LivelockFinding[] = []
  for (const scc of sccs) {
    if (!isCycle(scc, graph)) continue
    const stateKeys = new Set<string>(scc)
    const cycleEventTypes = new Set<string>()
    for (const stateKey of scc) {
      const node = graph.get(stateKey)!
      for (const edge of node.successors) {
        if (stateKeys.has(edge.to)) {
          cycleEventTypes.add(edge.selection.type)
        }
      }
    }
    const makesProgress = [...cycleEventTypes].some((t) => progress.includes(t))
    if (!makesProgress) {
      findings.push({
        code: 'livelock',
        states: [...scc],
        progressTypes: [...progress],
      })
    }
  }
  return findings
}

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
  /** Instance id stamped on synthetic traces. Defaults to a minted `ueid('bp_')` — pass the analyzed kernel's id to make joins natural. */
  instanceId?: string
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
  stateGraph: Map<string, StateNode>
}

type WorkItem = {
  messages: Trace[] // what you already push
  from?: string // stateKey of the state this item was pushed FROM
  via?: TraceEvent // the selection that was appended to get here
}

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
  instanceId = ueid('bp_'),
}: ExploreFrontiersArgs): ExploreFrontiersResult => {
  if (strategy !== 'bfs' && strategy !== 'dfs') {
    throw new Error(`Unsupported frontier exploration strategy "${String(strategy)}".`)
  }

  const pending: WorkItem[] = [{ messages }]
  const visited = new Set<string>()
  const stateGraph = new Map<string, StateNode>()
  const traces: TraceRecord[] = []
  const findings: DeadlockFinding[] = []
  let truncated = false

  while (pending.length > 0) {
    const current = strategy === 'bfs' ? pending.shift()! : pending.pop()!
    const { frontier, pending: currentPending } = replayToFrontier({
      threads,
      messages: current.messages,
      topic,
      instanceId,
    })

    const stateKey = frontierStateKey({ pending: currentPending })

    if (current.from !== undefined && current.via !== undefined) {
      const parent = stateGraph.get(current.from)
      if (parent) {
        parent.successors.push({ selection: current.via, to: stateKey })
      }
    }

    if (visited.has(stateKey)) continue
    visited.add(stateKey)
    const step = countSelectionTraces({ messages: current.messages })

    stateGraph.set(stateKey, {
      stateKey,
      frontier,
      step,
      successors: [],
    })

    const frontierTrace = createFrontierTrace({ frontier, step, instanceId })

    traces.push({
      messages: [...current.messages, frontierTrace],
    })

    const requestSuccessors = getRequestSuccessors({
      frontier,
      selectionPolicy,
      step,
      instanceId,
    })
    const triggerSuccessors = getTriggerSuccessors({
      pending: currentPending,
      messages: current.messages,
      threads,
      step,
      triggers,
      topic,
      instanceId,
    })
    const successors = [...requestSuccessors, ...triggerSuccessors]

    if (frontier.status === FRONTIER_STATUS.deadlock && triggerSuccessors.length === 0) {
      findings.push({
        code: 'deadlock',
        messages: [...current.messages, frontierTrace, createDeadlockTrace({ step, instanceId })],
      })
    }

    if (maxDepth !== undefined && step >= maxDepth) {
      if (successors.length > 0) {
        truncated = true
      }
      continue
    }

    for (const successor of successors) {
      pending.push({
        messages: [...current.messages, successor],
        from: stateKey,
        via: successor.selected,
      })
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
    stateGraph,
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
  livelocks: LivelockFinding[]
}

export type VerifyFrontiersArgs = ExploreFrontiersArgs & { progress?: string[] }

/**
 * Verifies a thread set by exploring its frontiers and deriving a
 * pass/fail/truncated status.
 *
 * @param args - {@link ExploreFrontiersArgs}
 * @returns {@link VerifyFrontiersResult}
 *
 * @public
 */
export const verifyFrontiers = ({ progress, ...args }: VerifyFrontiersArgs): VerifyFrontiersResult => {
  const { findings, report, stateGraph } = exploreFrontiers(args)
  const livelocks: LivelockFinding[] = []
  if (progress !== undefined) {
    livelocks.push(
      ...findLivelocks({
        progress,
        graph: stateGraph,
        sccs: findStronglyConnectedComponents(stateGraph),
      }),
    )
  }
  if (findings.length > 0 || livelocks.length > 0) {
    return {
      status: 'failed',
      findings,
      report,
      livelocks,
    }
  }

  if (report.truncated) {
    return {
      status: 'truncated',
      findings,
      report,
      livelocks,
    }
  }

  return {
    status: 'verified',
    findings,
    report,
    livelocks,
  }
}
