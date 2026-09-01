import type { FRONTIER_STATUS } from './behavioral.constants.ts'
import type { BPEvent, JsonObject, RegisteredIdioms, Thread, Trace } from './behavioral.schemas.ts'

export type RulesFunction = () => Generator<RegisteredIdioms, void, unknown>

export type UseThread = (rules: RulesFunction[], once?: true) => RulesFunction

/**
 * A factory type for a single synchronization step that yields one `RegisteredIdioms`
 * object (the engine's internal, topic-stamped idiom shape) and completes.
 *
 * @param arg - The registered idioms to yield at this synchronization point.
 * @returns A rule generator yielding the provided idioms once.
 *
 * @see {@link generateRulesFunctions} in `behavioral.utils.ts`, which builds
 * `RegisteredIdioms` (with topic stamping) from author-facing `Idioms`.
 */
export type Sync = (arg: RegisteredIdioms) => RulesFunction

/**
 * Composes an ordered array of rule generators into a single behavioral thread generator.
 *
 * @param rules - Rule generators (each yielding one `RegisteredIdioms`) to compose.
 * @param once - When `true`, the thread runs through the rules once and completes.
 *               When omitted, the thread loops the rules indefinitely.
 * @returns A generator function yielding the idioms from each rule in sequence.
 *
 * @remarks
 * - The `once` flag controls repetition semantics for the behavioral scheduler.
 * - Empty rule arrays complete immediately (the generator is `done` on first call).
 *
 * @see {@link generateRulesFunctions} for building the rule array from author-facing `Idioms`.
 */

/**
 * @internal
 * Represents a b-thread that is currently executing its rule sequence.
 *
 * These are threads that are active and running between synchronization
 * points. Running threads are those that have been moved from the
 * pending state after selecting an event that matches their `waitFor`
 * or `request` declarations.
 */
export type RunningBid = {
  /** Optional human-readable label for spawned thread instances. */
  label: string
  /** The priority level of the thread, used for resolving conflicts when multiple threads request events. Lower numbers = higher priority. */
  priority: number
  /** Internal iterator representing the thread's execution state. Holds the current position in the rule sequence. */
  generator: IterableIterator<RegisteredIdioms>
  ingress?: true
  topic?: string
}

/**
 * @internal
 * Represents a b-thread that has yielded and is waiting for the next event selection.
 *
 * These threads have reached a synchronization point and declared their `Idioms` (request, waitFor, block, interrupt).
 * The thread remains in this state until an event matching its `waitFor`, `request`, or `interrupt` is selected.
 */
export type PendingBid = RegisteredIdioms & RunningBid

/**
 * @internal
 * Represents a potential event candidate derived from a pending thread's request.
 *
 * During each super-step, the behavioral program collects all requested events as candidates,
 * filters out those that are blocked, and selects the highest priority remaining candidate.
 * This structure holds the metadata needed for this selection process.
 */
export type CandidateBid = {
  /** The priority of the thread proposing the event. Lower numbers indicate higher priority in the selection process. */
  priority: number
  /** The type of the requested event, used for matching against waitFor, block, and interrupt declarations. */
  type: string
  /** Optional detail payload of the requested event, contains any data associated with this event. */
  detail?: BPEvent['detail']

  ingress?: true
  topic?: string
}

/**
 * @internal
 * Frontier classification for the current pending set.
 *
 * This is an execution-oriented shape used by the scheduler to decide whether to:
 * - select and process an event (`ready`)
 * - emit a deadlock trace (`deadlock`)
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
  pending: Set<PendingBid>
  frontier: Frontier
}

/**
 * Represents a cleanup function for resource management.
 * Follows the disposable pattern for proper lifecycle management.
 *
 * @returns `void` or `Promise<void>` for asynchronous cleanup.
 *
 * @see {@link UseFeedback} for event handler cleanup
 * @see {@link UseTrace} for trace listener cleanup
 */
export type Disconnect = () => void | Promise<void>

/**
 * A callback function invoked with a trace of the behavioral program's state
 * after each event selection step (super-step). This provides a hook for observing
 * the program's internal execution state in real-time without affecting its behavior.
 *
 * The listener is called immediately after an event is selected but before the event is
 * published to feedback handlers. This allows for real-time monitoring, logging,
 * debugging, and analysis of the behavioral program's execution flow.
 *
 * @param msg - A trace describing the step (an engine {@link Trace} variant).
 * @returns `void` for synchronous listeners or `Promise<void>` for asynchronous
 *   processing. The return value is ignored by the behavioral program.
 *
 * @see {@link UseTrace} for registering trace listeners
 * @see {@link Trace} for the engine's trace structure
 */
export type TraceListener = (msg: Trace) => void | Promise<void>

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

/**
 * A feedback handler invoked when a matching event is selected and published.
 *
 * Handlers are the side-effect channel only — they never receive a handle to
 * remove themselves. Coordination (what stays, what goes) belongs to b-threads
 * (`request`/`waitFor`/`block`/`interrupt`) and the engine-side `useEject`; a
 * handler's lifetime is owned by its *caller* via the `Disconnect` returned
 * from `addHandler` (see `plan.md` Phase -1). Self-removal mid-dispatch would
 * smuggle callback-style coordination back into the side-effect channel.
 *
 * @typeParam T - Detail payload type for the event.
 *
 * @param params.detail - The JSON-serializable event detail.
 * @param params.trigger - Topic-scoped trigger to emit events back into the program.
 * @returns `void` or `Promise<void>`. Thrown errors surface as `feedback_error` traces.
 */
export type Handler<T> = (params: { detail: T; trigger: Trigger }) => void | Promise<void>

export type AddHandler = <T extends JsonObject | undefined = undefined>(
  type: string,
  handler: Handler<T>,
  once?: true,
) => () => void

export type UseAddHandler = (topic?: string) => AddHandler
/**
 * Hook for monitoring internal state transitions of the behavioral program.
 * Provides debugging, visualization, and analysis capabilities.
 *
 * @param listener - Callback receiving traces after each event selection.
 * @returns Disconnect function for cleanup.
 *
 * @remarks
 * - Called before feedback handlers
 * - Doesn't affect program execution
 * - Useful for debugging, tracing, and eval capture (see the `eval` skill)
 *
 * @see {@link Trace} for the engine's trace structure
 * @see {@link TraceListener} for listener type
 */
export type UseTrace = (listener: TraceListener) => Disconnect

export type AddThread = (args: Thread) => void

export type UseAddThread = (topic?: string) => AddThread

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

export type UseTrigger = (topic?: string) => Trigger

export type SendTrace<T> = {
  (value: T): void
  subscribe(listener: (msg: T) => void | Promise<void>): () => void
}
