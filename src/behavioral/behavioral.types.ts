import type {
  EVENT_SOURCES,
  EXPLORE_STRATEGIES,
  FRONTIER_STATUS,
  VERIFICATION_STATUSES,
} from './behavioral.constants.ts'
import type { BPEvent, BPListener, JsonObject, SelectionSnapshot, SnapshotMessage } from './behavioral.schemas.ts'

/**
 * Represents a fundamental unit of communication in behavioral programming.
 * An event consists of a mandatory `type` (string identifier) and an optional `detail` payload.
 * Events are used for communication between b-threads and are the core mechanism
 * through which the behavioral program coordinates execution.
 *
 * @template T - Expected type of the `detail` payload.
 * @property type - The string identifier for the event, used for matching and dispatching.
 * @property detail - Optional data payload associated with the event.
 *
 * @see {@link Trigger} for injecting events into the program
 */
export type ReplayEvent = BPEvent & {
  source: keyof typeof EVENT_SOURCES
}

/**
 * Represents a synchronization statement yielded by a behavioral rule step.
 * This is the core mechanism through which b-threads communicate their behavioral intentions
 * to the behavioral program scheduler at each step of execution.
 *
 * @property request - Propose an event to be selected and triggered. Only one request per sync point.
 * @property waitFor - Wait for specific events. Thread pauses until a matching event is selected.
 * @property block - Prevent specific events from being selected. Higher precedence than requests.
 * @property interrupt - Events that terminate the thread's execution if selected.
 *
 * @remarks
 * - Multiple listeners can be provided as arrays
 * - Blocked events have precedence over requested events
 * - Interrupts cause thread termination
 *
 * @see {@link ReturnType<BSync>} for usage in behavioral rule steps
 * @see {@link bSync} for creating single synchronization points
 */
export type Idioms = {
  /** Event(s) the thread is waiting for. Execution pauses until a matching event is selected. */
  waitFor?: BPListener | BPListener[]
  /** Event(s) that will interrupt the thread's execution if selected. */
  interrupt?: BPListener | BPListener[]
  /** An event the thread wishes to request. Can be a static event object or a template function. */
  request?: BPEvent
  /** Event(s) the thread wants to prevent from being selected. */
  block?: BPListener | BPListener[]
}

export type RulesFunction = () => Generator<Idioms, void, unknown>

/**
 * A factory function that creates a single synchronization step (a `ReturnType<BSync>`) for a b-thread.
 * This is a helper type that corresponds to the `bSync` function implementation, which creates
 * one branded behavioral rule step.
 *
 * @param arg - `Idioms` object defining the synchronization behavior for the step.
 * @returns Branded behavioral rule that yields the provided `Idioms` object once and completes.
 *
 * @see bSync The implementation of this type that creates reusable synchronization steps.
 */
export type Sync = (arg: Idioms) => RulesFunction

/**
 * A factory function that constructs a complete b-thread (`ReturnType<BSync>`) by composing multiple synchronization steps.
 * This is a helper type that corresponds to the `bThread` function implementation, which allows
 * for modular composition of b-thread behavior.
 *
 * @param rules - Synchronization steps, typically created with `bSync`, that define the thread sequence.
 * @param repeat - Optional repetition policy controlling whether the sequence repeats.
 * @returns Branded behavioral rule representing the composed thread.
 *
 * @see bThread The implementation of this type that composes multiple synchronization steps into a single b-thread.
 */
export type Thread = (rules: ReturnType<Sync>[], once?: true) => ReturnType<Sync>

/**
 * @internal
 * Represents a b-thread that is currently executing its current rule sequence.
 *
 * These are threads that are active and running between synchronization points.
 * Running threads are those that have been moved from the 'pending' state after an event
 * that matches their `waitFor`, `request`, or `interrupt` declarations has been selected.
 */
export type RunningBid = {
  /** Provenance of this bid for source-aware listener matching. */
  source: keyof typeof EVENT_SOURCES
  /** Optional human-readable label for spawned thread instances. */
  label: string
  /** The priority level of the thread, used for resolving conflicts when multiple threads request events. Lower numbers = higher priority. */
  priority: number
  /** Internal iterator representing the thread's execution state. Holds the current position in the rule sequence. */
  generator: IterableIterator<Idioms>
  ingress?: true
}

/**
 * @internal
 * Represents a b-thread that has yielded and is waiting for the next event selection.
 *
 * These threads have reached a synchronization point and declared their `Idioms` (request, waitFor, block, interrupt).
 * The thread remains in this state until an event matching its `waitFor`, `request`, or `interrupt` is selected.
 */
export type PendingBid = Idioms & RunningBid

/**
 * @internal
 * Represents a potential event candidate derived from a pending thread's request.
 *
 * During each super-step, the behavioral program collects all requested events as candidates,
 * filters out those that are blocked, and selects the highest priority remaining candidate.
 * This structure holds the metadata needed for this selection process.
 */
export type CandidateBid = {
  /** The identifier of the thread proposing the event. String for named threads */
  thread: string
  /** The priority of the thread proposing the event. Lower numbers indicate higher priority in the selection process. */
  priority: number
  /** The type of the requested event, used for matching against waitFor, block, and interrupt declarations. */
  type: string
  /** Optional detail payload of the requested event, contains any data associated with this event. */
  detail?: BPEvent['detail']
  /** Provenance of this candidate for source-aware listener matching. */
  source: keyof typeof EVENT_SOURCES

  ingress?: true
}

/**
 * @internal
 * Frontier classification for the current pending set.
 *
 * This is an execution-oriented shape used by the scheduler to decide whether to:
 * - select and process an event (`ready`)
 * - emit a deadlock snapshot (`deadlock`)
 * - do nothing (`idle`)
 */
export type Frontier = {
  candidates: CandidateBid[]
  enabled: CandidateBid[]
  status: keyof typeof FRONTIER_STATUS
}

/**
 * @internal
 * Reconstructed replay result for downstream explorer slices.
 */
export type ReplayToFrontierResult = {
  pending: Map<string, PendingBid>
  frontier: Frontier
}

/**
 * Represents a cleanup function for resource management.
 * Follows the disposable pattern for proper lifecycle management.
 *
 * @returns `void` or `Promise<void>` for asynchronous cleanup.
 *
 * @see {@link UseFeedback} for event handler cleanup
 * @see {@link UseSnapshot} for snapshot listener cleanup
 */
export type Disconnect = () => void | Promise<void>

/**
 * @internal
 * A function type responsible for formatting the internal state of the bProgram into a `SnapshotMessage`.
 *
 * This formatter transforms the raw internal program state into a standardized, human-readable format
 * that can be consumed by snapshot listeners, debuggers, and visualization tools.
 *
 * The formatter analyzes the relationships between threads (who blocks whom, who interrupts whom),
 * determines which event was selected, and creates a comprehensive view of the current execution step.
 */
export type SelectionFormatter = (args: {
  /** Map of threads currently in a pending state (yielded), containing their synchronization declarations. */
  pending: Map<string, PendingBid>
  /** The event candidate that was selected for execution in the current step. */
  selectedEvent: CandidateBid
  /** All event candidates that were considered for selection in the current step. */
  candidates: CandidateBid[]
}) => SelectionSnapshot

/**
 * A callback function invoked with a snapshot (`SnapshotMessage`) of the behavioral program's state
 * after each event selection step (super-step). This provides a hook for observing the program's
 * internal execution state in real-time without affecting its behavior.
 *
 * The listener is called immediately after an event is selected but before the event is published
 * to feedback handlers. This allows for real-time monitoring, logging, debugging, and analysis
 * of the behavioral program's execution flow.
 *
 * @param msg - Snapshot describing the candidate events considered during the step, including
 * selected, blocked, and interrupted relationships.
 * @returns `void` for synchronous listeners or `Promise<void>` for asynchronous processing. The
 * return value is ignored by the behavioral program.
 *
 * @see {@link UseSnapshot} for registering snapshot listeners
 * @see {@link SnapshotMessage} for snapshot structure
 */
export type SnapshotListener = (msg: SnapshotMessage) => void | Promise<void>

/**
 * Represents a generic structure for event detail payloads.
 * It's a record where keys are string identifiers (typically event property names)
 * and values can be of any type. This type is often used as a constraint
 * in more specific event handling types to allow for arbitrary data.
 *
 * It serves as the default type for the `Details` generic parameter in `Handlers<Details>`,
 * meaning if no specific event map is provided, handlers will expect `EventDetails` for
 * their payloads.
 */
// biome-ignore lint/suspicious/noExplicitAny: Default event map allows any detail type, constrained by Handlers<T>
export type EventDetails = Record<string, any>

export type Handler<T> = (detail: T, disconnect: Disconnect) => void | Promise<void>

export type AddHandler = <T extends JsonObject | undefined = undefined>(
  type: string,
  handler: Handler<T>,
  once?: true,
) => () => void

/**
 * Hook for monitoring internal state transitions of the behavioral program.
 * Provides debugging, visualization, and analysis capabilities.
 *
 * @param listener - Callback receiving snapshots after each event selection.
 * @returns Disconnect function for cleanup.
 *
 * @remarks
 * - Called before feedback handlers
 * - Doesn't affect program execution
 * - Useful for debugging and tooling
 *
 * @see {@link SnapshotMessage} for snapshot structure
 * @see {@link SnapshotListener} for listener type
 */
export type UseSnapshot = (listener: SnapshotListener) => Disconnect

/**
 * Publishes a structured snapshot message directly to snapshot subscribers.
 *
 * @remarks
 * This does not schedule events or advance the BP engine.
 */
export type ReportError = (error: string) => void

export type BThreads = Record<string, ReturnType<Sync>>

export type AddThread = (label: string, thread: () => Generator<Idioms, void, unknown>) => void

/**
 * Injects external events into the behavioral program.
 * Primary interface for external systems to communicate with the program.
 *
 * @param args - Event to trigger, including its `type` and optional `detail`.
 *
 * @remarks
 * - Triggered events have highest priority (0)
 * - Can be blocked by active threads
 * - Initiates new execution cycle
 *
 * @see {@link BPEvent} for event structure
 * @see {@link PlaitedTrigger} for enhanced trigger
 */
export type Trigger = <T extends BPEvent>(args: T) => void

/**
 * Factory function that creates and initializes a new behavioral program instance.
 * Returns an immutable API for thread management, event handling, and state monitoring.
 *
 * @returns Readonly behavioral programming API.
 *
 * @remarks
 * Super-step execution model:
 * 1. Advance threads to synchronization points
 * 2. Collect and filter event requests
 * 3. Select highest priority event
 * 4. Notify relevant threads
 * 5. Publish to feedback handlers
 * 6. Repeat until no events remain
 *
 * @see {@link BThreads} for thread management
 * @see {@link Trigger} for event injection
 * @see {@link UseFeedback} for event handling
 * @see {@link UseSnapshot} for state monitoring
 */
export type Behavioral = () => Readonly<{
  addHandler: AddHandler
  addThread: AddThread
  reportError: ReportError
  trigger: Trigger
  useSnapshot: UseSnapshot
}>

type ExploreStrategy = keyof typeof EXPLORE_STRATEGIES

export type DeadlockFinding = {
  code: 'deadlock'
  history: ReplayEvent[]
  status: Frontier['status']
  candidates: Frontier['candidates']
  enabled: Frontier['enabled']
  summary: {
    candidateCount: number
    enabledCount: number
  }
}

export type FrontierSummary = {
  history: ReplayEvent[]
  status: Frontier['status']
}

type ExploreFrontiersReport = {
  strategy: ExploreStrategy
  visitedCount: number
  findingCount: number
  /**
   * True only when the explorer encountered at least one `ready` frontier that it did not expand
   * because `maxDepth` was reached for that history.
   *
   * This does not indicate generic incompleteness: `idle`/`deadlock` terminal frontiers keep this false
   * even when `maxDepth` is set.
   */
  truncated: boolean
  maxDepth?: number
}

type ExploreFrontiersResult = {
  report: ExploreFrontiersReport
  visitedHistories: ReplayEvent[][]
  findings: DeadlockFinding[]
  frontierSummaries?: FrontierSummary[]
}

export type ExploreFrontiers = (args: {
  threads: BThreads
  strategy: ExploreStrategy
  maxDepth?: number
  includeFrontierSummaries?: boolean
}) => ExploreFrontiersResult

export type ExploreFrontiersArgs = Parameters<ExploreFrontiers>[0]

export type VerifyFrontiersResult = {
  status: keyof typeof VERIFICATION_STATUSES
  report: ExploreFrontiersResult['report']
  findings: ExploreFrontiersResult['findings']
}
