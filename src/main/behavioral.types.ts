/**
 * @internal
 * Defines the repetition behavior for a `bThread`.
 * - `true`: The thread repeats indefinitely.
 * - `function`: A predicate function evaluated before each repetition. The thread repeats if the function returns `true`.
 * - `undefined` or omitted: The thread executes once and terminates.
 *
 * @see {@link bThread} for creating threads with repetition
 */
export type Repeat = true | (() => boolean)

/**
 * Represents a fundamental unit of communication in behavioral programming.
 * An event consists of a mandatory `type` (string identifier) and an optional `detail` payload.
 * Events are used for communication between b-threads and are the core mechanism
 * through which the behavioral program coordinates execution.
 *
 * @template T The expected type of the `detail` payload. Defaults to `any` for flexibility.
 * @property type - The string identifier for the event, used for matching and dispatching.
 * @property detail - Optional data payload associated with the event.
 *
 * @see {@link BPEventTemplate} for dynamic event generation
 * @see {@link Trigger} for injecting events into the program
 */
// biome-ignore lint/suspicious/noExplicitAny: Event payloads can be of any type, typed at usage site
export type BPEvent = { type: string; detail?: any }

/**
 * A factory function that generates a `BPEvent` dynamically.
 * Particularly useful within `bSync` definitions when the event details need to be computed
 * at the exact moment the synchronization point is reached rather than when the b-thread
 * is initially defined.
 *
 * @template T The expected type of the `detail` payload for the generated event.
 * @returns A `BPEvent` object when the function is invoked.
 *
 * @remarks
 * Event templates are evaluated each time the synchronization point is reached,
 * ensuring fresh data for each execution cycle.
 *
 * @see {@link BPEvent} for static event definitions
 */
export type BPEventTemplate = () => BPEvent

/**
 * Defines how a b-thread listens for or specifies events in `waitFor`, `block`, or `interrupt` idioms.
 * This type provides a flexible way to match events based on simple string identifiers or complex conditions.
 *
 * It can be one of:
 * 1. A simple `string`: Matches events exactly by their `type` property.
 * 2. A predicate function: Takes an event object and returns `true` if the event matches the desired criteria.
 *
 * @see {@link Idioms} for using listeners in synchronization
 * @see {@link bSync} for creating synchronization points
 */
export type BPListener = string | ((args: BPEvent) => boolean)

/**
 * Represents a synchronization statement within a b-thread's generator function.
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
 * @see {@link RulesFunction} for usage in generator functions
 * @see {@link bSync} for creating single synchronization points
 */
export type Idioms = {
  /** Event(s) the thread is waiting for. Execution pauses until a matching event is selected. */
  waitFor?: BPListener | BPListener[]
  /** Event(s) that will interrupt the thread's execution if selected. */
  interrupt?: BPListener | BPListener[]
  /** An event the thread wishes to request. Can be a static event object or a template function. */
  request?: BPEvent | BPEventTemplate
  /** Event(s) the thread wants to prevent from being selected. */
  block?: BPListener | BPListener[]
}

/**
 * A generator function defining the behavior of a b-thread.
 * This is the fundamental unit of behavior in the BP (Behavioral Programming) paradigm,
 * representing a sequential process that can synchronize with other b-threads.
 *
 * @returns A Generator that yields `Idioms` objects at synchronization points.
 *
 * @remarks
 * The execution flow:
 * 1. Thread yields an `Idioms` object to declare intentions
 * 2. Generator pauses, transferring control to scheduler
 * 3. Scheduler selects an event based on all threads' declarations
 * 4. Thread resumes when a matching event occurs
 *
 * @see {@link bThread} for creating threads from rules
 * @see {@link Idioms} for synchronization declarations
 */
export type RulesFunction = () => Generator<Idioms, void, undefined>

/**
 * A factory function that creates a single synchronization step (a `RulesFunction`) for a b-thread.
 * This is a helper type that corresponds to the `bSync` function implementation, which creates
 * a generator function that yields exactly one synchronization point.
 *
 * @template T The type of the event detail payload relevant to this synchronization point.
 * @param arg The `Idioms<T>` object defining the synchronization behavior (request, waitFor, block, interrupt).
 * @returns A `RulesFunction` (generator function) that yields the provided `Idioms` object once and completes.
 *
 * @see bSync The implementation of this type that creates reusable synchronization steps.
 */
export type BSync = (arg: Idioms) => () => Generator<Idioms, void, unknown>

/**
 * A factory function that constructs a complete b-thread (`RulesFunction`) by composing multiple synchronization steps.
 * This is a helper type that corresponds to the `bThread` function implementation, which allows
 * for modular composition of b-thread behavior.
 *
 * @param rules An array of `RulesFunction`s, typically created using `bSync`, defining the sequence of steps for the thread.
 * @param repeat Optional configuration (`Repeat`) to control if and how the thread repeats its sequence of rules.
 * @returns A `RulesFunction` representing the combined behavior of the provided rules, potentially repeating.
 *
 * @see bThread The implementation of this type that composes multiple synchronization steps into a single b-thread.
 */
export type BThread = (rules: RulesFunction[], repeat?: Repeat) => RulesFunction

/**
 * @internal
 * Represents a b-thread that is currently executing its generator function.
 *
 * These are threads that are active and running between synchronization points.
 * Running threads are those that have been moved from the 'pending' state after an event
 * that matches their `waitFor`, `request`, or `interrupt` declarations has been selected.
 */
export type RunningBid = {
  /** Internal flag indicating if this bid originated from an external trigger. */
  trigger?: true
  /** The priority level of the thread, used for resolving conflicts when multiple threads request events. Lower numbers = higher priority. */
  priority: number
  /** The generator iterator representing the thread's execution state. Holds the current position in the thread's execution flow. */
  generator: IterableIterator<Idioms>
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
  /** The identifier of the thread proposing the event. String for named threads, Symbol for trigger-originated threads. */
  thread: string | symbol
  /** The priority of the thread proposing the event. Lower numbers indicate higher priority in the selection process. */
  priority: number
  /** The type of the requested event, used for matching against waitFor, block, and interrupt declarations. */
  type: string
  /** Optional detail payload of the requested event, contains any data associated with this event. */
  detail?: unknown
  /** Internal flag indicating if this bid originated from an external trigger rather than a thread request. */
  trigger?: true
  /** If the request was a template function, this holds the original template function reference for comparison. */
  template?: BPEventTemplate
}

/**
 * Represents a cleanup function for resource management.
 * Follows the disposable pattern for proper lifecycle management.
 *
 * @returns void or Promise<void> for async cleanup
 *
 * @see {@link UseFeedback} for event handler cleanup
 * @see {@link UseSnapshot} for snapshot listener cleanup
 */
export type Disconnect = () => void | Promise<void>

/**
 * Represents a snapshot of the behavioral program's state at a specific super-step.
 * Each element describes an active b-thread or event candidate.
 *
 * @property thread - Thread identifier (stringified if from trigger)
 * @property trigger - Whether bid originated from external trigger
 * @property selected - Whether this bid was selected for execution
 * @property type - Event type being requested or waited for
 * @property detail - Optional event payload data
 * @property priority - Priority level (lower = higher priority)
 * @property blockedBy - ID of blocking thread if blocked
 * @property interrupts - ID of interrupted thread if interrupting
 *
 * @remarks
 * - Array is sorted by priority
 * - Useful for debugging and visualization
 * - Shows complete program state per step
 *
 * @see {@link UseSnapshot} for subscribing to snapshots
 * @see {@link SnapshotListener} for handling snapshots
 */
export type SnapshotMessage = {
  /** The unique identifier of the thread associated with this bid (stringified if this bid originated from an external `trigger()` as they use a Symbol identifier). */
  thread: string
  /** Indicates if this bid originated from an external `trigger()` call (`true`) rather than a thread's `request` (`false`). */
  trigger: boolean
  /** Indicates if this specific bid (request) was the one selected for execution in the current step. */
  selected: boolean
  /** The type of event the thread is requesting or waiting for. */
  type: string
  /** Optional data payload associated with the event. */
  detail?: unknown
  /** The priority level assigned to the thread's bid. Lower numbers indicate higher priority. */
  priority: number
  /** If the event is blocked, contains the identifier of the thread that blocked it; otherwise, undefined. */
  blockedBy?: string
  /** If the event interrupts another thread when selected, contains the identifier of the interrupted thread; otherwise, undefined. */
  interrupts?: string
}[]

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
export type SnapshotFormatter = (args: {
  /** Map of threads currently in a pending state (yielded), containing their synchronization declarations. */
  pending: Map<string | symbol, PendingBid>
  /** The event candidate that was selected for execution in the current step. */
  selectedEvent: CandidateBid
  /** All event candidates that were considered for selection in the current step. */
  candidates: CandidateBid[]
}) => SnapshotMessage

/**
 * A callback function invoked with a snapshot (`SnapshotMessage`) of the behavioral program's state
 * after each event selection step (super-step). This provides a hook for observing the program's
 * internal execution state in real-time without affecting its behavior.
 *
 * The listener is called immediately after an event is selected but before the event is published
 * to feedback handlers. This allows for real-time monitoring, logging, debugging, and analysis
 * of the behavioral program's execution flow.
 *
 * @param msg An array (`SnapshotMessage`) detailing the status of each event candidate during the step,
 *            including which one was selected, which were blocked, thread priorities, and relationships.
 * @returns May return `void` for synchronous listeners or a `Promise<void>` for asynchronous processing.
 *          The return value is not used by the bProgram, so async operations won't block execution.
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

/**
 * @internal
 * Defines the basic structure for event handlers used in `useFeedback`.
 *
 * A record where keys are event types (strings) and values are callback functions
 * that handle the event's detail payload when the corresponding event is selected.
 *
 * This type provides a flexible foundation for type-specific handler definitions
 * through the more specialized `Handlers<T>` type. Both synchronous and asynchronous
 * handler functions are supported.
 */
// biome-ignore lint/suspicious/noExplicitAny: Default handlers accept any detail type, refined by Handlers<T> generic
export type DefaultHandlers = Record<string, (detail: any) => void | Promise<void>>

/**
 * Represents a collection of event handlers for behavioral program feedback.
 * Maps event types to handler functions that process selected events.
 *
 * @template Details Type map for event payloads, enabling type-safe handlers
 *
 * @remarks
 * - Supports both sync and async handlers
 * - Type-safe when using generics
 * - Handlers are called when events are selected
 *
 * @see {@link UseFeedback} for registering handlers
 * @see {@link BPEvent} for event structure
 */
export type Handlers<Details extends EventDetails = EventDetails> = {
  // Create specific handler signatures from the EventPayloadMap
  [K in keyof Details]: (detail: Details[K]) => void | Promise<void>
} & DefaultHandlers

/**
 * Hook for subscribing to events selected by the behavioral program.
 * Primary mechanism for external systems to react to program state changes.
 *
 * @param handlers Object mapping event types to handler functions
 * @returns Disconnect function for cleanup
 *
 * @remarks
 * - Maintains separation of concerns
 * - Supports sync and async handlers
 * - Always call disconnect for cleanup
 *
 * @see {@link Handlers} for handler types
 * @see {@link Disconnect} for cleanup
 */
export type UseFeedback = (handlers: Handlers) => Disconnect

/**
 * Hook for monitoring internal state transitions of the behavioral program.
 * Provides debugging, visualization, and analysis capabilities.
 *
 * @param listener Callback receiving snapshots after each event selection
 * @returns Disconnect function for cleanup
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
 * Interface for managing b-threads within a behavioral program.
 * Provides dynamic thread addition, replacement, and status monitoring.
 *
 * @property has - Check thread existence and status (running/pending)
 * @property set - Add or replace threads in the program
 *
 * @remarks
 * - Thread names must be unique
 * - Replacing a thread stops the old one
 * - Status reflects current execution state
 *
 * @see {@link RulesFunction} for thread implementation
 * @see {@link bThread} for creating threads
 */
export type BThreads = {
  /**
   * Checks the status of a specific thread.
   *
   * @param thread - The string identifier of the thread to check.
   * @returns An object with boolean flags indicating if the thread is `running` and/or `pending`.
   */
  has: (thread: string | symbol) => { running: boolean; pending: boolean }

  /**
   * Adds or replaces threads in the program.
   * If a thread with the given identifier already exists, it will be replaced.
   *
   * @param threads - An object mapping thread identifiers (string keys) to their implementation
   *                 as `RulesFunction` generator functions.
   */
  set: (threads: Record<string | symbol, RulesFunction>) => void
}

/**
 * Injects external events into the behavioral program.
 * Primary interface for external systems to communicate with the program.
 *
 * @param args BPEvent to trigger with type and optional detail
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
 * @returns Readonly object with core behavioral programming API
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
  bThreads: BThreads
  trigger: Trigger
  useFeedback: UseFeedback
  useSnapshot: UseSnapshot
}>

/**
 * An enhanced `Trigger` type specifically for Plaited components or contexts.
 * It extends the standard `Trigger` by adding a method (`addDisconnectCallback`)
 * to associate cleanup functions (`Disconnect`) with the trigger's lifecycle.
 * This allows resources or subscriptions initiated via the trigger's context
 * to be properly cleaned up when the context is destroyed.
 *
 * @property addDisconnectCallback - A function to register a cleanup callback that should be
 *   executed when the component or context associated with this trigger is disconnected
 */
export type PlaitedTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}

/**
 * Type definition for signal subscription function.
 * Enables event-based monitoring of signal value changes.
 *
 * @param eventType Event type identifier for the triggered event
 * @param trigger Component's trigger function for handling value changes
 * @param getLVC Whether to immediately trigger with current value
 * @returns Cleanup function for removing the subscription
 */
export type Listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean) => Disconnect

/**
 * @internal
 * Signal type for values that must have an initial value.
 * Guarantees get() never returns undefined.
 */
export type SignalWithInitialValue<T> = {
  set(value: T): void
  listen: Listen
  get(): T
}

/**
 * @internal
 * Signal type for optional values that may start undefined.
 * Useful for async data or optional state.
 */
export type SignalWithoutInitialValue<T> = {
  set(value?: T): void
  listen: Listen
  get(): T | undefined
}

/**
 * @internal
 * Union type for all signal variants.
 * Type system ensures correct usage based on initialization.
 */
export type Signal<T> = SignalWithInitialValue<T> | SignalWithoutInitialValue<T>
