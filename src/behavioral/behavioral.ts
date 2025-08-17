import { isTypeOf } from '../utils.js'

/**
 * Defines the repetition behavior for a `bThread`.
 * - `true`: The thread repeats indefinitely.
 * - `function`: A predicate function evaluated before each repetition. The thread repeats if the function returns `true`.
 * - `undefined` or omitted: The thread executes once and terminates.
 *
 * @example Repeat indefinitely
 * ```ts
 * const infiniteLoop = bThread([
 *   bSync({ request: { type: 'PING' } }),
 *   bSync({ waitFor: 'PONG' })
 * ], true);
 * ```
 *
 * @example Repeat with condition
 * ```ts
 * let counter = 0;
 * const limitedLoop = bThread([
 *   bSync({ request: { type: 'COUNT', detail: { value: counter } } })
 * ], () => counter++ < 5);
 * ```
 *
 * @see {@link bThread} for creating threads with repetition
 */
type Repeat = true | (() => boolean)

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
 * @example Event with typed detail
 * ```ts
 * interface LoginDetails {
 *   userId: string;
 *   timestamp: number;
 *   rememberMe: boolean;
 * }
 *
 * const loginEvent: BPEvent<LoginDetails> = {
 *   type: 'USER_LOGIN',
 *   detail: {
 *     userId: 'usr123',
 *     timestamp: Date.now(),
 *     rememberMe: true
 *   }
 * };
 * ```
 *
 * @example Simple event without detail
 * ```ts
 * const initEvent: BPEvent = { type: 'INITIALIZE' };
 * ```
 *
 * @see {@link BPEventTemplate} for dynamic event generation
 * @see {@link Trigger} for injecting events into the program
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * @example Dynamic timestamp generation
 * ```ts
 * const timestampedRequest = bSync({
 *   request: () => ({
 *     type: 'LOG_EVENT',
 *     detail: { timestamp: Date.now() }
 *   })
 * });
 * ```
 *
 * @example Stateful event generation
 * ```ts
 * let requestCount = 0;
 * const countedRequest = bSync({
 *   request: () => ({
 *     type: 'API_REQUEST',
 *     detail: {
 *       requestId: ++requestCount,
 *       timestamp: Date.now()
 *     }
 *   })
 * });
 * ```
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
 * @example Simple string matching
 * ```ts
 * // Listen for specific event type
 * const loginListener: BPListener = 'USER_LOGIN';
 *
 * bSync({
 *   waitFor: 'USER_LOGIN',
 *   request: { type: 'SHOW_DASHBOARD' }
 * });
 * ```
 *
 * @example Pattern matching with predicates
 * ```ts
 * // Listen for events matching a pattern
 * const errorListener: BPListener = ({ type }) =>
 *   type.startsWith('ERROR_');
 *
 * // Listen for events with specific detail values
 * const highPriorityListener: BPListener = ({ detail }) =>
 *   detail?.priority === 'high';
 * ```
 *
 * @example Complex filtering
 * ```ts
 * const complexListener: BPListener = ({ type, detail }) =>
 *   type === 'DATA_LOADED' &&
 *   detail?.status === 'success' &&
 *   detail?.records > 0;
 *
 * bSync({
 *   waitFor: [loginListener, complexListener],
 *   block: errorListener,
 *   request: { type: 'PROCEED' }
 * });
 * ```
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
 * @example Basic synchronization
 * ```ts
 * // Simple request-wait pattern
 * yield {
 *   request: { type: 'FETCH_DATA' }
 * };
 * yield {
 *   waitFor: ['DATA_LOADED', 'FETCH_ERROR']
 * };
 * ```
 *
 * @example Complex coordination
 * ```ts
 * // Multi-thread coordination with blocking
 * yield {
 *   waitFor: 'USER_LOGIN',
 *   block: 'SESSION_TIMEOUT',
 *   request: { type: 'INITIALIZE_SESSION' }
 * };
 * ```
 *
 * @example Interruption handling
 * ```ts
 * // Long process with cancellation support
 * yield {
 *   request: { type: 'START_UPLOAD' },
 *   interrupt: 'CANCEL_UPLOAD'
 * };
 * ```
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
 * @example Authentication flow
 * ```ts
 * function* authenticationFlow(): RulesFunction {
 *   // Request login UI
 *   yield { request: { type: 'SHOW_LOGIN' } };
 *
 *   // Wait for user action
 *   yield {
 *     waitFor: ['LOGIN_ATTEMPT', 'CANCEL'],
 *     block: 'LOGOUT' // Prevent logout during login
 *   };
 *
 *   // Handle result
 *   yield { waitFor: ['AUTH_SUCCESS', 'AUTH_FAILURE'] };
 * }
 * ```
 *
 * @example Data synchronization
 * ```ts
 * function* dataSyncThread(): RulesFunction {
 *   while (true) {
 *     // Wait for changes
 *     yield { waitFor: 'DATA_CHANGED' };
 *
 *     // Request sync, can be interrupted
 *     yield {
 *       request: { type: 'SYNC_DATA' },
 *       interrupt: 'APP_CLOSING'
 *     };
 *
 *     // Wait for completion
 *     yield { waitFor: ['SYNC_COMPLETE', 'SYNC_ERROR'] };
 *   }
 * }
 * ```
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
 * Type guard to check if an unknown value conforms to the `BPEvent` structure.
 * Verifies if the value is an object with a `type` property that is a string.
 * This is useful for runtime validation of events, especially when receiving data
 * from external sources or when working with dynamically typed values.
 *
 * @param data The value to check against the `BPEvent` structure.
 * @returns `true` if the value is a valid `BPEvent`, `false` otherwise.
 *
 * @example Validating external data
 * ```ts
 * // Handling messages from a WebSocket
 * websocket.onmessage = (event) => {
 *   const data = JSON.parse(event.data);
 *
 *   if (isBPEvent(data)) {
 *     trigger(data); // Safe to use as BPEvent
 *   } else {
 *     console.error('Invalid event format:', data);
 *   }
 * };
 * ```
 *
 * @example Worker message validation
 * ```ts
 * worker.addEventListener('message', (e) => {
 *   if (isBPEvent(e.data)) {
 *     // Process valid behavioral event
 *     handleBPEvent(e.data);
 *   }
 * });
 * ```
 *
 * @see {@link BPEvent} for the structure being validated
 */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return (
    isTypeOf<{ [key: string]: unknown }>(data, 'object') &&
    Object.hasOwn(data, 'type') &&
    isTypeOf<string>(data.type, 'string')
  )
}

/**
 * Creates a behavioral thread (b-thread) by combining a sequence of synchronization rules.
 * A b-thread is a generator function that defines a strand of behavior within a `bProgram`.
 *
 * @param rules An array of `RulesFunction`s defining the sequential steps of the thread.
 * @param repeat Controls if and how the thread repeats its sequence.
 * @returns A `RulesFunction` representing the complete b-thread.
 *
 * @example Game loop thread
 * ```ts
 * // Continuous game loop
 * const gameLoop = bThread([
 *   bSync({ request: { type: 'UPDATE_PHYSICS' } }),
 *   bSync({ request: { type: 'RENDER_FRAME' } }),
 *   bSync({ waitFor: 'FRAME_COMPLETE' })
 * ], true); // Repeat indefinitely
 * ```
 *
 * @example Conditional repetition
 * ```ts
 * let retries = 0;
 * const retryLogic = bThread([
 *   bSync({ request: { type: 'ATTEMPT_CONNECTION' } }),
 *   bSync({ waitFor: ['CONNECTED', 'CONNECTION_FAILED'] })
 * ], () => retries++ < 3); // Retry up to 3 times
 * ```
 *
 * @example State machine thread
 * ```ts
 * const stateMachine = bThread([
 *   bSync({ waitFor: 'INIT', request: { type: 'STATE_IDLE' } }),
 *   bSync({ waitFor: 'START', request: { type: 'STATE_RUNNING' } }),
 *   bSync({ waitFor: 'STOP', request: { type: 'STATE_IDLE' } })
 * ], true); // Cycle through states
 * ```
 *
 * @remarks
 * - Rules are executed sequentially
 * - Repetition is evaluated after completing all rules
 * - Threads can be interrupted mid-sequence
 *
 * @see {@link bSync} for creating individual rules
 * @see {@link RulesFunction} for the generator type
 */
export const bThread: BThread = (rules, repeat) => {
  return repeat ?
      function* () {
        while (isTypeOf<boolean>(repeat, 'boolean') ? repeat : repeat()) {
          const length = rules.length
          for (let i = 0; i < length; i++) {
            yield* rules[i]()
          }
        }
      }
    : function* () {
        const length = rules.length
        for (let i = 0; i < length; i++) {
          yield* rules[i]()
        }
      }
}

/**
 * Creates a single synchronization point for a b-thread.
 * This is the fundamental building block for constructing b-threads.
 *
 * @param syncPoint The `Idioms` object defining the synchronization behavior.
 * @returns A `RulesFunction` that yields the `syncPoint` once.
 *
 * @example Basic request-response pattern
 * ```ts
 * const requestData = bSync({
 *   request: { type: 'FETCH_USER_DATA' }
 * });
 *
 * const waitForResponse = bSync({
 *   waitFor: ['DATA_RECEIVED', 'FETCH_ERROR']
 * });
 *
 * // Compose into a thread
 * const fetchThread = bThread([requestData, waitForResponse]);
 * ```
 *
 * @example Complex synchronization
 * ```ts
 * const coordinatedSync = bSync({
 *   request: { type: 'PROCESS_START', detail: { id: 123 } },
 *   waitFor: ['READY', 'ABORT'],
 *   block: 'SYSTEM_SHUTDOWN',
 *   interrupt: 'EMERGENCY_STOP'
 * });
 * ```
 *
 * @example Dynamic event generation
 * ```ts
 * const dynamicRequest = bSync({
 *   request: () => ({
 *     type: 'METRIC',
 *     detail: {
 *       timestamp: Date.now(),
 *       memoryUsage: process.memoryUsage()
 *     }
 *   })
 * });
 * ```
 *
 * @remarks
 * - Each `bSync` creates a single-yield generator
 * - Can be composed with `bThread` for sequences
 * - Supports all idioms: request, waitFor, block, interrupt
 *
 * @see {@link bThread} for composing multiple sync points
 * @see {@link Idioms} for synchronization options
 */
export const bSync: BSync = (syncPoint) =>
  function* () {
    yield syncPoint
  }

/**
 * @internal
 * Represents a b-thread that is currently executing its generator function.
 *
 * These are threads that are active and running between synchronization points.
 * Running threads are those that have been moved from the 'pending' state after an event
 * that matches their `waitFor`, `request`, or `interrupt` declarations has been selected.
 */
type RunningBid = {
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
type PendingBid = Idioms & RunningBid

/**
 * @internal
 * Represents a potential event candidate derived from a pending thread's request.
 *
 * During each super-step, the behavioral program collects all requested events as candidates,
 * filters out those that are blocked, and selects the highest priority remaining candidate.
 * This structure holds the metadata needed for this selection process.
 */
type CandidateBid = {
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
 * @example Component cleanup
 * ```ts
 * const MyComponent = bElement({
 *   bProgram({ trigger, useFeedback }) {
 *     // Set up subscriptions
 *     const disconnect1 = useFeedback(handlers);
 *     const disconnect2 = externalService.subscribe();
 *
 *     // Register cleanup
 *     trigger.addDisconnectCallback(() => {
 *       disconnect1();
 *       disconnect2();
 *     });
 *   }
 * });
 * ```
 *
 * @example Manual resource management
 * ```ts
 * const { useFeedback, useSnapshot } = bProgram();
 *
 * const feedbackCleanup = useFeedback(handlers);
 * const snapshotCleanup = useSnapshot(logger);
 *
 * // Later, clean up both
 * const cleanup = () => {
 *   feedbackCleanup();
 *   snapshotCleanup();
 * };
 * ```
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
 * @example Analyzing program state
 * ```ts
 * const { useSnapshot } = bProgram();
 *
 * useSnapshot((snapshot) => {
 *   // Find selected event
 *   const selected = snapshot.find(s => s.selected);
 *   console.log(`Selected: ${selected?.type}`);
 *
 *   // Check for blocked events
 *   const blocked = snapshot.filter(s => s.blockedBy);
 *   if (blocked.length > 0) {
 *     console.log(`${blocked.length} events blocked`);
 *   }
 *
 *   // Analyze thread priorities
 *   const byPriority = [...snapshot].sort(
 *     (a, b) => a.priority - b.priority
 *   );
 * });
 * ```
 *
 * @example Deadlock detection
 * ```ts
 * useSnapshot((snapshot) => {
 *   const hasRequests = snapshot.some(s => !s.blockedBy);
 *   const hasSelected = snapshot.some(s => s.selected);
 *
 *   if (!hasSelected && hasRequests) {
 *     console.warn('Potential deadlock detected');
 *   }
 * });
 * ```
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
type SnapshotFormatter = (args: {
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
 * @example
 * // Basic logging of selected events
 * const basicLogger: SnapshotListener = (snapshot) => {
 *   const selected = snapshot.find(s => s.selected);
 *   if (selected) {
 *     console.log(`Event selected: ${selected.type}`, selected.detail);
 *   } else {
 *     console.log('No event selected - possible deadlock or program end');
 *   }
 * };
 *
 * @example
 * // More comprehensive analysis and visualization
 * const analyzer: SnapshotListener = (snapshot) => {
 *   // Log the entire state table
 *   console.table(snapshot.map(s => ({
 *     Thread: s.thread,
 *     Event: s.type,
 *     Selected: s.selected ? '✓' : '',
 *     Priority: s.priority,
 *     Blocked: s.blockedBy ? `by ${s.blockedBy}` : '',
 *     Interrupts: s.interrupts || '',
 *     External: s.trigger ? '✓' : ''
 *   })));
 *
 *   // Analyze for potential issues
 *   const blocked = snapshot.filter(s => s.blockedBy);
 *   if (blocked.length > 0) {
 *     console.log(`${blocked.length} events were blocked in this step`);
 *   }
 *
 *   // Track execution flow
 *   const selected = snapshot.find(s => s.selected);
 *   if (selected) {
 *     eventHistory.push(selected.type);
 *     updateVisualGraph(eventHistory, snapshot);
 *   }
 * };
 *
 * // Register with the bProgram
 * const { useSnapshot } = bProgram();
 * const unsubscribe = useSnapshot(analyzer);
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
 *
 * @example
 * ```typescript
 * // Example of an event detail object conforming to EventDetails
 * const loginEventDetails: EventDetails = {
 *   username: "testuser",
 *   timestamp: 1678886400000,
 *   rememberMe: true,
 * };
 *
 * // Can be used to type event payloads in a generic way
 * function handleEvent(type: string, details: EventDetails) {
 *   console.log(`Event ${type} occurred with details:`, details);
 * }
 *
 * // When used with Handlers without a specific detail type
 * const genericHandlers: Handlers = {
 *   'ANY_EVENT': (details) => { // details here is EventDetails
 *     console.log(details.someProperty);
 *   }
 * };
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultHandlers = Record<string, (detail: any) => void | Promise<void>>

/**
 * Represents a collection of event handlers for behavioral program feedback.
 * Maps event types to handler functions that process selected events.
 *
 * @template Details Type map for event payloads, enabling type-safe handlers
 *
 * @example Typed event handlers
 * ```ts
 * type AppEvents = {
 *   'USER_LOGIN': { userId: string; timestamp: number };
 *   'DATA_UPDATE': { records: any[]; source: string };
 *   'ERROR': { code: string; message: string };
 * };
 *
 * const handlers: Handlers<AppEvents> = {
 *   'USER_LOGIN': ({ userId, timestamp }) => {
 *     console.log(`User ${userId} logged in`);
 *     updateSession(userId);
 *   },
 *
 *   'DATA_UPDATE': async ({ records, source }) => {
 *     await database.save(records);
 *     notifyDataChange(source);
 *   },
 *
 *   'ERROR': ({ code, message }) => {
 *     logger.error(`Error ${code}: ${message}`);
 *     showErrorDialog(message);
 *   }
 * };
 * ```
 *
 * @example Component integration
 * ```ts
 * const MyComponent = bElement({
 *   bProgram({ useFeedback }) {
 *     return {
 *       // Direct handler definition
 *       'BUTTON_CLICK': () => {
 *         console.log('Button clicked');
 *       },
 *
 *       // Async handler for API calls
 *       'SAVE_DATA': async (data) => {
 *         await api.save(data);
 *         showSuccessMessage();
 *       }
 *     };
 *   }
 * });
 * ```
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
 * @example UI component integration
 * ```ts
 * const Component = () => {
 *   const { useFeedback, trigger } = behavioral();
 *
 *   useEffect(() => {
 *     const disconnect = useFeedback({
 *       'SHOW_MODAL': ({ title, content }) => {
 *         modalRef.current?.show(title, content);
 *       },
 *
 *       'UPDATE_STATUS': (status) => {
 *         setStatusText(status);
 *       },
 *
 *       'FETCH_DATA': async ({ url }) => {
 *         const data = await fetch(url).then(r => r.json());
 *         setData(data);
 *       }
 *     });
 *
 *     return disconnect; // Cleanup on unmount
 *   }, []);
 * };
 * ```
 *
 * @example Service integration
 * ```ts
 * class DataService {
 *   constructor(program: ReturnType<typeof behavioral>) {
 *     this.disconnect = program.useFeedback({
 *       'SAVE_DATA': async (data) => {
 *         await this.database.save(data);
 *         this.emit('saved', data);
 *       },
 *
 *       'DELETE_DATA': async ({ id }) => {
 *         await this.database.delete(id);
 *         this.emit('deleted', id);
 *       }
 *     });
 *   }
 *
 *   destroy() {
 *     this.disconnect();
 *   }
 * }
 * ```
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
 * @example Debugging and logging
 * ```ts
 * const { useSnapshot } = behavioral();
 *
 * const disconnect = useSnapshot(snapshot => {
 *   // Log selected event
 *   const selected = snapshot.find(s => s.selected);
 *   console.log(`Step: ${selected?.type || 'none'}`);
 *
 *   // Check for issues
 *   const blocked = snapshot.filter(s => s.blockedBy);
 *   if (blocked.length > 0) {
 *     console.warn(`Blocked: ${blocked.map(s => s.type)}`);
 *   }
 * });
 * ```
 *
 * @example Execution visualization
 * ```ts
 * const history: SnapshotMessage[] = [];
 *
 * useSnapshot(snapshot => {
 *   history.push(snapshot);
 *
 *   // Visualize execution flow
 *   renderExecutionGraph(history);
 *
 *   // Detect patterns
 *   if (history.length > 100) {
 *     const pattern = detectCycles(history);
 *     if (pattern) {
 *       console.log('Detected cycle:', pattern);
 *     }
 *   }
 * });
 * ```
 *
 * @example Performance monitoring
 * ```ts
 * let stepCount = 0;
 * const startTime = Date.now();
 *
 * useSnapshot(snapshot => {
 *   stepCount++;
 *
 *   // Track execution rate
 *   const elapsed = Date.now() - startTime;
 *   const stepsPerSecond = stepCount / (elapsed / 1000);
 *
 *   if (stepsPerSecond < 100) {
 *     console.warn('Performance degradation detected');
 *   }
 * });
 * ```
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
 * @example Thread lifecycle management
 * ```ts
 * const { bThreads } = behavioral();
 *
 * // Add initial threads
 * bThreads.set({
 *   'auth': authThread,
 *   'data': dataThread,
 *   'ui': uiThread
 * });
 *
 * // Check thread status
 * const status = bThreads.has('auth');
 * if (status.running) {
 *   console.log('Auth thread is executing');
 * } else if (status.pending) {
 *   console.log('Auth thread is waiting');
 * }
 *
 * // Dynamically replace thread
 * if (userLoggedIn) {
 *   bThreads.set({
 *     'auth': loggedInAuthThread
 *   });
 * }
 * ```
 *
 * @example Conditional thread addition
 * ```ts
 * const { bThreads, trigger } = behavioral();
 *
 * // Base threads
 * const baseThreads = {
 *   'core': coreLogic,
 *   'monitor': monitoringThread
 * };
 *
 * // Add feature threads based on config
 * if (features.analytics) {
 *   baseThreads['analytics'] = analyticsThread;
 * }
 *
 * if (features.realtime) {
 *   baseThreads['websocket'] = websocketThread;
 * }
 *
 * bThreads.set(baseThreads);
 * ```
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
  has: (thread: string) => { running: boolean; pending: boolean }

  /**
   * Adds or replaces threads in the program.
   * If a thread with the given identifier already exists, it will be replaced.
   *
   * @param threads - An object mapping thread identifiers (string keys) to their implementation
   *                 as `RulesFunction` generator functions.
   */
  set: (threads: Record<string, RulesFunction>) => void
}
/**
 * Injects external events into the behavioral program.
 * Primary interface for external systems to communicate with the program.
 *
 * @param args BPEvent to trigger with type and optional detail
 *
 * @example UI event triggering
 * ```ts
 * const { trigger } = behavioral();
 *
 * // React component example
 * function LoginForm() {
 *   const handleSubmit = (e) => {
 *     e.preventDefault();
 *     trigger({
 *       type: 'LOGIN_ATTEMPT',
 *       detail: {
 *         username: e.target.username.value,
 *         password: e.target.password.value
 *       }
 *     });
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 *
 * @example Service integration
 * ```ts
 * class WebSocketService {
 *   constructor(trigger: Trigger) {
 *     this.ws = new WebSocket(url);
 *
 *     this.ws.onmessage = (event) => {
 *       const data = JSON.parse(event.data);
 *
 *       // Forward to behavioral program
 *       trigger({
 *         type: 'WS_MESSAGE',
 *         detail: data
 *       });
 *     };
 *
 *     this.ws.onerror = () => {
 *       trigger({ type: 'WS_ERROR' });
 *     };
 *   }
 * }
 * ```
 *
 * @example Timer-based triggers
 * ```ts
 * const { trigger } = behavioral();
 *
 * // Periodic updates
 * setInterval(() => {
 *   trigger({ type: 'TICK' });
 * }, 1000);
 *
 * // Delayed action
 * setTimeout(() => {
 *   trigger({
 *     type: 'TIMEOUT',
 *     detail: { reason: 'inactivity' }
 *   });
 * }, 30000);
 * ```
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
 * @example Complete behavioral program setup
 * ```ts
 * // Create program instance
 * const { bThreads, trigger, useFeedback, useSnapshot } = behavioral();
 *
 * // Define and add threads
 * bThreads.set({
 *   'userFlow': bThread([
 *     bSync({ request: { type: 'SHOW_WELCOME' } }),
 *     bSync({ waitFor: 'USER_ACTION' }),
 *     bSync({ request: { type: 'PROCESS_ACTION' } })
 *   ]),
 *
 *   'validator': bThread([
 *     bSync({ waitFor: 'USER_ACTION', block: 'PROCESS_ACTION' }),
 *     bSync({ request: { type: 'VALIDATE' } }),
 *     bSync({ request: { type: 'PROCESS_ACTION' } })
 *   ], true)
 * });
 *
 * // Set up event handlers
 * useFeedback({
 *   'SHOW_WELCOME': () => showWelcomeScreen(),
 *   'PROCESS_ACTION': () => processUserAction(),
 *   'VALIDATE': () => validateInput()
 * });
 *
 * // Monitor execution (development)
 * if (DEBUG) {
 *   useSnapshot(snapshot => {
 *     console.table(snapshot);
 *   });
 * }
 *
 * // Start the program
 * trigger({ type: 'INIT' });
 * ```
 *
 * @example Game loop with behavioral programming
 * ```ts
 * const game = behavioral();
 *
 * game.bThreads.set({
 *   'gameLoop': bThread([
 *     bSync({ request: { type: 'UPDATE' } }),
 *     bSync({ request: { type: 'RENDER' } })
 *   ], true),
 *
 *   'inputHandler': bThread([
 *     bSync({ waitFor: 'KEY_PRESS' }),
 *     bSync({ request: { type: 'PLAYER_ACTION' } })
 *   ], true)
 * });
 *
 * game.useFeedback({
 *   'UPDATE': () => updateGameState(),
 *   'RENDER': () => renderFrame(),
 *   'PLAYER_ACTION': () => handlePlayerInput()
 * });
 * ```
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
 * @internal
 * A simple listener function that always returns true, used for triggered events.
 * This allows externally triggered events to satisfy the waitFor condition in the trigger thread.
 */
const triggerWaitFor = () => true

/**
 * @internal
 * Creates a simple publish-subscribe mechanism for event distribution.
 *
 * This function creates a publisher that maintains a set of listeners and provides methods
 * to publish values to all listeners and to subscribe/unsubscribe listeners.
 *
 * @template T The type of values that will be published through this mechanism.
 * @returns A publisher function with a `subscribe` method attached.
 */
const createPublisher = <T>() => {
  const listeners = new Set<(value: T) => void | Promise<void>>()
  function publisher(value: T) {
    for (const cb of listeners) {
      void cb(value)
    }
  }
  publisher.subscribe = (listener: (msg: T) => void | Promise<void>) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return publisher
}

/**
 * @internal
 * Utility function to ensure a value is an array.
 *
 * If the input is already an array, it is returned unchanged.
 * If the input is not an array, it is wrapped in an array.
 *
 * @template T The type of elements in the array.
 * @param obj The value to ensure is an array. Defaults to an empty array if undefined.
 * @returns An array containing the input value(s).
 */
const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])

/**
 * @internal
 * Creates a checker function to determine if a given BPListener matches a CandidateBid.
 *
 * This is used to check if an event matches waitFor, block, or interrupt declarations.
 *
 * @param type The event type to check against.
 * @param detail The event detail payload to check against.
 * @returns A function that takes a BPListener and returns true if it matches the event.
 */
const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean =>
    isTypeOf<string>(listener, 'string') ?
      listener === type
    : listener({
        detail,
        type,
      })
}

/**
 * @internal
 * Checks if a pending request (Idiom['request']) matches the selected event candidate.
 *
 * This is used to determine if a thread's request was the one selected during event selection.
 *
 * @param selectedEvent The event candidate that was selected.
 * @param event The request from a thread's Idioms to check against the selected event.
 * @returns True if the request matches the selected event, false otherwise.
 */
const isPendingRequest = (selectedEvent: CandidateBid, event: BPEvent | BPEventTemplate) =>
  isTypeOf<BPEventTemplate>(event, 'function') ? event === selectedEvent?.template : event.type == selectedEvent.type

/**
 * @internal
 * Formats the current state (pending bids, candidates, selected event) into a SnapshotMessage array.
 *
 * This function analyzes the relationships between threads (blocking, interruption), determines
 * which event was selected, and creates a comprehensive view of the current execution step.
 * The resulting array is sorted by priority to show higher priority events first.
 */
const snapshotFormatter: SnapshotFormatter = ({ candidates, selectedEvent, pending }) => {
  const blockingThreads = [...pending].flatMap(([thread, { block }]) =>
    block && Array.isArray(block) ? block.map((listener) => ({ block: listener, thread }))
    : block ? [{ block, thread }]
    : [],
  )
  const interruptedThreads = [...pending].flatMap(([thread, { interrupt }]) =>
    interrupt && Array.isArray(interrupt) ? interrupt.map((listener) => ({ interrupt: listener, thread }))
    : interrupt ? [{ interrupt, thread }]
    : [],
  )

  const ruleSets: {
    thread: string
    trigger: boolean
    selected: boolean
    type: string
    detail?: unknown
    priority: number
    blockedBy?: string
    interrupts?: string
  }[] = []
  for (const bid of candidates) {
    const blockedBy = blockingThreads.find(({ block }) => isListeningFor(bid)(block))?.thread
    const interrupts = interruptedThreads.find(({ interrupt }) => isListeningFor(bid)(interrupt))?.thread
    const thread = bid.thread
    const message: SnapshotMessage[number] = {
      thread: isTypeOf<symbol>(thread, 'symbol') ? thread?.toString() : thread,
      trigger: bid.trigger ?? false,
      type: bid.type,
      selected: isPendingRequest(selectedEvent, bid),
      priority: bid.priority,
      detail: bid.detail,
      blockedBy: isTypeOf<symbol>(blockedBy, 'symbol') ? blockedBy?.toString() : blockedBy,
      interrupts: isTypeOf<symbol>(interrupts, 'symbol') ? interrupts?.toString() : interrupts,
    }
    ruleSets.push(message)
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}
/**
 * Creates and manages a behavioral program instance, orchestrating the execution of b-threads.
 * This function implements the core logic of the Behavioral Programming execution model (super-steps).
 *
 * The behavioral program is the central coordination mechanism that manages a collection of
 * behavioral threads (b-threads) and orchestrates their synchronized execution according to
 * the BP paradigm. It maintains the state of all active threads, processes their synchronization
 * statements, selects events, and handles the publication of events to external subscribers.
 *
 * @returns An immutable object (`BProgramAPI`) containing functions to interact with the program.
 *
 * @remarks
 * The execution follows these general steps (super-step):
 *
 * 1. **Run Active Threads:** Advance all threads currently in the 'running' state to their next `yield`.
 *    This is where threads actually execute their code until they reach a synchronization point.
 *
 * 2. **Collect Bids:** Gather `request`, `waitFor`, and `block` declarations (`Idioms`) from all
 *    threads now in the 'pending' state. These declarations represent what each thread wants to
 *    do next.
 *
 * 3. **Select Event:** Identify candidate events (from `request` declarations). Filter out any
 *    candidates blocked by `block` declarations. Select the highest priority candidate event
 *    among the remaining ones.
 *
 * 4. **Notify & Update:**
 *    - If an event is selected:
 *      - Publish a snapshot if a listener is attached (for debugging/monitoring).
 *      - Identify threads waiting for, requesting, or interrupted by the selected event.
 *        Move these threads back to the 'running' state.
 *      - Publish the selected event via the `actionPublisher` (for `useFeedback` handlers).
 *      - Start the next super-step (`run()`).
 *    - If no event is selected (deadlock or program end), the execution halts until a new
 *      event is triggered externally.
 *
 * The program's execution is driven by events - either requested by threads or triggered
 * externally. It will continue executing super-steps as long as there are events to select
 * and threads to run. If no events can be selected (either because all requests are blocked
 * or there are no requests), the program will pause until an external event is triggered.
 *
 */
export const behavioral: Behavioral = () => {
  /**
   * @internal
   * Map of threads that have yielded and are waiting for event selection.
   *
   * Key: threadId (string for named threads, Symbol for trigger-originated threads)
   * Value: PendingBid containing the thread's generator and yielded Idioms.
   * These threads have reached a synchronization point and declared their behavioral intentions.
   */
  const pending = new Map<string | symbol, PendingBid>()

  /**
   * @internal
   * Map of threads whose generators are ready to run (or have just been triggered).
   *
   * Key: threadId (string for named threads, Symbol for trigger-originated threads)
   * Value: RunningBid containing the thread's generator.
   * These threads are about to execute until they yield at their next synchronization point.
   */
  const running = new Map<string | symbol, RunningBid>()

  /**
   * @internal
   * Publisher for selected events, consumed by `useFeedback`.
   * This is the mechanism by which selected events are delivered to external handlers.
   */
  const actionPublisher = createPublisher<BPEvent>()

  /**
   * @internal
   * Publisher for state snapshots, consumed by `useSnapshot`. Lazily initialized.
   * This is only created when a snapshot listener is registered, to avoid unnecessary overhead.
   */
  let snapshotPublisher:
    | {
        (value: SnapshotMessage): void
        subscribe(listener: (msg: SnapshotMessage) => void | Promise<void>): () => void
      }
    | undefined

  /**
   * @internal
   * Initiates a super-step if there are running threads.
   * This is the entry point for the behavioral program's execution cycle.
   * It checks if there are any threads ready to run, and if so, advances them.
   */
  function run() {
    running.size && step()
  }

  /**
   * @internal
   * Executes one part of the super-step: advancing running threads to their next yield.
   *
   * This function:
   * 1. Iterates through all running threads
   * 2. Advances each thread's generator to its next yield point
   * 3. Captures the yielded Idioms (synchronization declarations)
   * 4. Moves the thread from 'running' to 'pending' state
   * 5. Proceeds to the event selection phase
   */
  function step() {
    for (const [thread, bid] of running) {
      const { generator, priority, trigger } = bid
      const { value, done } = generator.next()
      !done &&
        pending.set(thread, {
          priority,
          ...(trigger && { trigger }),
          generator,
          ...value,
        })
      running.delete(thread)
    }
    selectNextEvent()
  }

  /**
   * @internal
   * Executes the event selection part of the super-step.
   *
   * This function:
   * 1. Collects all block declarations from pending threads
   * 2. Collects all request declarations as candidate events
   * 3. Filters out candidates that are blocked
   * 4. Selects the highest priority remaining candidate
   * 5. If an event is selected and there is a defined snapshot publisher, publishes a snapshot and proceeds to the next step
   * 6. If no event is selected, the super-step ends (program pauses until external trigger)
   */
  function selectNextEvent() {
    const blocked: BPListener[] = []
    const candidates: CandidateBid[] = []
    for (const [thread, { request, priority, block, trigger }] of pending) {
      block && blocked.push(...ensureArray(block))
      request &&
        candidates.push({
          priority,
          trigger,
          thread,
          ...(isTypeOf<BPEventTemplate>(request, 'function') ? { template: request, ...request() } : request),
        })
    }
    const filteredBids: CandidateBid[] = []
    const length = candidates.length
    for (let i = 0; i < length; i++) {
      const candidate = candidates[i]
      if (!blocked.some(isListeningFor(candidate))) {
        filteredBids.push(candidate)
      }
    }
    /** @internal Priority Queue BPEvent Selection Strategy */
    const selectedEvent = filteredBids.sort(
      ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB,
    )[0]
    if (selectedEvent) {
      snapshotPublisher && snapshotPublisher(snapshotFormatter({ candidates, selectedEvent, pending }))
      nextStep(selectedEvent)
    }
  }

  /**
   * @internal
   * Processes the selected event, updates thread states, and triggers the next cycle.
   *
   * This function:
   * 1. Identifies threads waiting for, requesting, or interrupted by the selected event
   * 2. Terminates threads that were interrupted
   * 3. Moves affected threads from 'pending' back to 'running' state
   * 4. Publishes the selected event to feedback handlers
   * 5. Initiates the next super-step
   *
   * @param selectedEvent The event candidate that was selected for this step
   */
  function nextStep(selectedEvent: CandidateBid) {
    for (const [thread, bid] of pending) {
      const { waitFor, request, generator, interrupt } = bid
      const isInterrupted = ensureArray(interrupt).some(isListeningFor(selectedEvent))
      const isWaitedFor = ensureArray(waitFor).some(isListeningFor(selectedEvent))
      const hasPendingRequest = request && isPendingRequest(selectedEvent, request)
      isInterrupted && generator.return?.()
      if (hasPendingRequest || isInterrupted || isWaitedFor) {
        running.set(thread, bid)
        pending.delete(thread)
      }
    }
    /**
     * @internal
     * To avoid infinite loop with calling trigger from feedback always publish select event
     * after checking if request(s) is waitList and before our next run
     */
    actionPublisher({ type: selectedEvent.type, detail: selectedEvent.detail })
    run()
  }

  /**
   * @internal
   * Implementation of the public `trigger` function.
   *
   * This creates a special temporary thread with highest priority (0) that:
   * 1. Requests the specified event
   * 2. Waits for any event (using triggerWaitFor which always returns true)
   * 3. Terminates after the event is processed
   *
   * The thread is identified by a Symbol based on the event type for uniqueness.
   */
  const trigger: Trigger = (request) => {
    const thread = function* () {
      yield {
        request,
        waitFor: [triggerWaitFor],
      }
    }
    running.set(Symbol(request.type), {
      priority: 0,
      trigger: true,
      generator: thread(),
    })
    run()
  }

  /**
   * @internal
   * Implementation of the public `useFeedback` hook.
   *
   * This subscribes the provided handlers to the action publisher, which will
   * invoke the appropriate handler whenever a matching event is selected.
   * It returns a disconnect function that removes the subscription when called.
   */
  const useFeedback: UseFeedback = (handlers) => {
    const disconnect = actionPublisher.subscribe((data: BPEvent) => {
      const { type, detail = {} } = data
      if (Object.hasOwn(handlers, type)) {
        void handlers[type](detail)
      }
    })
    return disconnect
  }

  /**
   * @internal
   * Implementation of the public `bThreads` utility.
   *
   * This provides methods to add/replace threads and check thread status.
   * The implementation ensures proper thread initialization and state tracking.
   */
  const bThreads: BThreads = {
    set: (threads) => {
      for (const thread in threads) {
        running.set(thread, {
          priority: running.size + 1,
          generator: threads[thread](),
        })
      }
    },
    has: (thread) => ({ running: running.has(thread), pending: pending.has(thread) }),
  }

  /**
   * @internal
   * Implementation of the public `useSnapshot` hook.
   *
   * This lazily initializes the snapshot publisher if needed, then
   * subscribes the provided listener to receive state snapshots.
   * It returns a disconnect function that removes the subscription when called.
   */
  const useSnapshot: UseSnapshot = (listener) => {
    if (snapshotPublisher === undefined) snapshotPublisher = createPublisher<SnapshotMessage>()
    const unsubscribe = snapshotPublisher.subscribe(listener)
    return () => {
      unsubscribe()
      snapshotPublisher = undefined
    }
  }

  /**
   * @internal
   * Return the frozen public API object.
   *
   * Object.freeze ensures the API surface is immutable, preventing accidental
   * modification of the program's interface. This provides a stable and
   * predictable API for consumers of the behavioral program.
   */
  return Object.freeze({
    /** Provides methods to manage behavioral threads (`set`, `has`). */
    bThreads,
    /** Function to inject external events into the program. */
    trigger,
    /** Hook to subscribe to selected events with feedback handlers. */
    useFeedback,
    /** Hook to subscribe to internal state snapshots for monitoring/debugging. */
    useSnapshot,
  })
}
