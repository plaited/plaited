import type { BPEvent, BPEventTemplate, BPListener, Idioms, RulesFunction } from './b-thread.js'
import { isTypeOf } from '../utils/is-type-of.js'

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
 * Represents a cleanup function, typically returned by subscription or registration mechanisms
 * like `useFeedback` and `useSnapshot`. This function follows the common disposable pattern
 * in JavaScript/TypeScript for resource management.
 *
 * When called, this function performs all necessary cleanup actions, such as:
 * - Removing event listeners or subscribers
 * - Stopping observation of state changes
 * - Freeing resources to prevent memory leaks
 * - Cancelling pending operations
 *
 * @returns void - Performs the cleanup action when called with no return value.
 *
 * @example
 * ```typescript
 * const disconnect = useFeedback(handlers);
 * // Later, when cleanup is needed:
 * disconnect();
 * ```
 */
export type Disconnect = () => void

/**
 * Represents a snapshot of the behavioral program's state at a specific step (super-step).
 * It's an array where each element describes the status of an active b-thread or event candidate.
 *
 * This snapshot provides a comprehensive view of the program's internal state during execution,
 * showing which events were requested, which were blocked, which was selected, and how threads
 * interact with each other. It's particularly valuable for:
 *
 * - Debugging complex behavioral systems
 * - Monitoring program execution in real-time
 * - Visualizing thread interactions and dependencies
 * - Understanding race conditions or deadlocks
 * - Creating development tools and debuggers
 *
 * The array is sorted by priority (lower numbers first), so the highest priority
 * event candidates appear first in the array.
 *
 * @property thread - The unique identifier of the thread associated with this bid (stringified if from `trigger()`).
 * @property trigger - Indicates if this bid originated from external `trigger()` (true) vs thread's `request` (false).
 * @property selected - Indicates if this bid was selected for execution in the current step.
 * @property type - The event type the thread is currently requesting or waiting for.
 * @property detail - Optional data payload associated with the event.
 * @property priority - The priority level of the thread's bid. Lower numbers = higher priority.
 * @property blockedBy - If this thread's request is blocked, ID of the blocking thread.
 * @property interrupts - If this bid interrupts another thread, ID of the interrupted thread.
 *
 * @example
 * // Example of a snapshot with three event candidates
 * [
 *   {
 *     thread: "loginThread",
 *     trigger: false,
 *     selected: true,  // This event was selected
 *     type: "USER_LOGIN",
 *     detail: { username: "user1", timestamp: 1622756040000 },
 *     priority: 1,     // Highest priority (lowest number)
 *     blockedBy: undefined,
 *     interrupts: "timeoutThread"
 *   },
 *   {
 *     thread: "Symbol(BUTTON_CLICK)",
 *     trigger: true,   // This came from external trigger()
 *     selected: false,
 *     type: "BUTTON_CLICK",
 *     detail: { buttonId: "submit" },
 *     priority: 0,     // Even higher priority, but was blocked
 *     blockedBy: "validationThread",
 *     interrupts: undefined
 *   },
 *   {
 *     thread: "notificationThread",
 *     trigger: false,
 *     selected: false,
 *     type: "SHOW_NOTIFICATION",
 *     detail: { message: "Welcome!" },
 *     priority: 3,     // Lowest priority
 *     blockedBy: undefined,
 *     interrupts: undefined
 *   }
 * ]
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
 * Represents a collection of callback functions (handlers) keyed by event type,
 * used with `useFeedback` to react to selected events in a behavioral program.
 *
 * When a `bProgram` selects an event during execution, it checks if there's a handler
 * registered for that event type in this collection. If found, the handler is invoked
 * with the event's `detail` payload, allowing external systems to respond to the
 * internal state transitions of the behavioral program.
 *
 * This type supports both synchronous and asynchronous handlers, making it suitable
 * for a wide range of use cases from UI updates to API calls or database operations.
 *
 * @template Details Allows extending the base `DefaultHandlers` with more specific, typed handlers.
 *             This enables strong type checking for event detail payloads.
 *
 * @example
 * // Define typed handlers for specific events in your application
 * type AppHandlers = Handlers<{
 *   // User authentication events
 *   'USER_LOGIN': (credentials: { username: string; timestamp: number }) => void;
 *   'USER_LOGOUT': (data: { reason: 'manual' | 'timeout' | 'forced' }) => void;
 *
 *   // Data operations with async handlers
 *   'DATA_LOAD': (params: { resourceId: string; refresh?: boolean }) => Promise<void>;
 *   'DATA_SAVE': (payload: { data: Record<string, unknown>; options?: SaveOptions }) => Promise<void>;
 *
 *   // UI events
 *   'UI_NAVIGATE': (route: { path: string; params?: Record<string, string> }) => void;
 * }>;
 *
 * // Using the typed handlers
 * const appHandlers: AppHandlers = {
 *   // TypeScript provides full type checking for these handler parameters
 *   'USER_LOGIN': ({ username, timestamp }) => {
 *     console.log(`${username} logged in at ${new Date(timestamp).toLocaleString()}`);
 *     updateAuthState(username);
 *   },
 *
 *   'USER_LOGOUT': ({ reason }) => {
 *     if (reason === 'timeout') {
 *       showTimeoutNotification();
 *     }
 *     clearUserSession();
 *   },
 *
 *   'DATA_LOAD': async ({ resourceId, refresh = false }) => {
 *     setLoadingState(true);
 *     try {
 *       const data = await fetchResource(resourceId, { forceRefresh: refresh });
 *       updateDataStore(data);
 *     } catch (error) {
 *       handleError(error);
 *     } finally {
 *       setLoadingState(false);
 *     }
 *   },
 *
 *   // Can also include generic handlers via DefaultHandlers
 *   'ANALYTICS_EVENT': (detail) => {
 *     trackEvent(detail); // detail is typed as 'any'
 *   }
 * };
 *
 * // Register handlers with the bProgram
 * const { useFeedback } = bProgram();
 * const disconnect = useFeedback(appHandlers);
 */
export type Handlers<Details extends EventDetails = EventDetails> = {
  // Create specific handler signatures from the EventPayloadMap
  [K in keyof Details]: (detail: Details[K]) => void | Promise<void>
} & DefaultHandlers

/**
 * A hook for subscribing to the events selected and published by the behavioral program.
 * This is the primary way for external systems (UI components, services, etc.) to react to
 * the internal state changes and events occurring within the behavioral program.
 *
 * Unlike direct manipulation of state, this reactive approach maintains proper separation
 * of concerns - the behavioral program handles its internal logic and coordination,
 * while external systems only need to respond to events as they occur.
 *
 * @template T The specific type definition for the `handlers` object, extending `DefaultHandlers`.
 *             Use this to enforce type safety for your event payloads.
 *
 * @param handlers An object where keys are event type strings and values are the corresponding handler functions.
 *                 Each handler receives the `detail` payload of the selected event and can perform any
 *                 side effects or state updates needed in response to the event.
 *
 * @returns A `Disconnect` function that, when called, unsubscribes the provided handlers and stops
 *          them from receiving events. This should be called during cleanup (e.g., component unmount).
 *
 * @example
 * // Creating a behavioral program and subscribing to its events
 * const { useFeedback } = bProgram();
 *
 * // Subscribe to specific events with appropriate handlers
 * const disconnect = useFeedback({
 *   // UI-related events
 *   'UI_SHOW_MODAL': (config) => {
 *     modalSystem.open(config.modalType, config.modalProps);
 *   },
 *   'UI_HIDE_MODAL': () => {
 *     modalSystem.close();
 *   },
 *
 *   // Data-related events
 *   'DATA_UPDATED': (updates) => {
 *     updateUIComponents(updates);
 *     saveToLocalStorage('appData', updates);
 *   },
 *
 *   // Authentication events with async handling
 *   'AUTH_LOGOUT': async (reason) => {
 *     await apiClient.logout();
 *     router.navigateTo('/login');
 *     if (reason === 'session_expired') {
 *       notifications.show('Your session has expired. Please log in again.');
 *     }
 *   }
 * });
 *
 * // To stop listening later (e.g., component cleanup):
 * // disconnect();
 */
export type UseFeedback = <T extends EventDetails = EventDetails>(handlers: Handlers<T>) => Disconnect

/**
 * A hook for registering a `SnapshotListener` to monitor the internal state transitions of the b-program.
 * This provides a window into the behavioral program's execution, showing which events were requested,
 * which were blocked, which was selected, and how threads interact with each other.
 *
 * This hook is primarily intended for:
 * - Debugging complex behavioral systems
 * - Logging execution flow for analysis
 * - Monitoring and observing program behavior
 * - Creating development tools and visualizers
 * - Educational purposes to understand BP concepts
 *
 * Note that snapshot listeners are called *before* the selected event is published to feedback handlers,
 * allowing you to observe the internal state just before external side effects occur.
 *
 * @param listener The `SnapshotListener` callback function that will receive the `SnapshotMessage`
 *                 array after each event selection step (super-step). The listener can process this
 *                 information synchronously or asynchronously without affecting program execution.
 *
 * @returns A `Disconnect` function. Call this function to unregister the snapshot listener and stop
 *          receiving snapshots. This should be called during cleanup to prevent memory leaks.
 *
 * @example
 * // Basic snapshot monitoring for debugging
 * const { useSnapshot } = bProgram();
 *
 * const disconnectSnapshot = useSnapshot((snapshot) => {
 *   // Find the selected event (if any)
 *   const selected = snapshot.find(s => s.selected);
 *
 *   // Log complete program state at this step
 *   console.log(`Event selected: ${selected?.type || 'none'}`);
 *   console.table(snapshot);
 * });
 *
 * @example
 * // Advanced usage: Creating a visualization of the program's execution
 * const { useSnapshot } = bProgram();
 *
 * // Track the history of events and state transitions
 * const executionHistory = [];
 *
 * const disconnectVisualizer = useSnapshot((snapshot) => {
 *   // Record this step in history
 *   const selected = snapshot.find(s => s.selected);
 *
 *   executionHistory.push({
 *     timestamp: Date.now(),
 *     selectedEvent: selected ? { type: selected.type, detail: selected.detail } : null,
 *     threadCount: new Set(snapshot.map(s => s.thread)).size,
 *     blockedEvents: snapshot.filter(s => s.blockedBy).length,
 *     stateSnapshot: JSON.parse(JSON.stringify(snapshot)) // Deep copy for history
 *   });
 *
 *   // Update visualization with the new history
 *   updateExecutionGraph(executionHistory);
 *   updateEventTimeline(executionHistory);
 *   updateThreadStateTable(snapshot);
 * });
 *
 * // When done monitoring
 * // disconnectVisualizer();
 */
export type UseSnapshot = (listener: SnapshotListener) => Disconnect

/**
 * Provides methods for managing the b-threads within a `bProgram` instance.
 * This interface allows dynamic addition, replacement, and status checking of
 * behavioral threads during program execution.
 *
 * B-threads represent individual strands of behavior in the program, and this
 * API provides the means to control their lifecycle and monitor their state.
 *
 * @property has - Checks if a thread with the given identifier exists and reports its status (running or pending).
 *                 - `running`: The thread's generator is currently executing (between yields).
 *                 - `pending`: The thread has yielded and is waiting for the next event selection.
 * @property set - Adds new b-threads to the program or replaces existing ones. Takes an object where keys are thread identifiers
 *                 and values are the corresponding `RulesFunction` (generator functions).
 *
 * @example
 * const { bThreads } = bProgram();
 *
 * // Add multiple threads to the program
 * bThreads.set({
 *   'authenticator': authenticationRules,
 *   'notifier': notificationRules,
 *   'dataSync': dataSyncRules
 * });
 *
 * // Check if a specific thread exists and its status
 * const authStatus = bThreads.has('authenticator');
 * if (authStatus.running) {
 *   console.log('Authentication thread is currently executing');
 * } else if (authStatus.pending) {
 *   console.log('Authentication thread is waiting at a synchronization point');
 * } else {
 *   console.log('Authentication thread is not active');
 * }
 *
 * // Replace a thread with a new implementation
 * bThreads.set({
 *   'dataSync': improvedDataSyncRules
 * });
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
 * A function used to inject external events into the behavioral program.
 * Triggering an event initiates a new execution cycle (super-step) starting with this event.
 *
 * This is the primary way for external systems (such as UI components, services, or
 * other parts of your application) to communicate with the behavioral program. When an
 * external event is triggered, it's treated as a high-priority request (priority 0)
 * coming from a special thread.
 *
 * The triggered event goes through the normal selection process - it can be blocked
 * by any active thread's `block` declarations and must compete with other requested events.
 * If selected, it can cause threads waiting for matching events to resume execution.
 *
 * @template T The type of the `detail` payload for the event being triggered.
 * @param args The `BPEvent<T>` object to trigger, containing a `type` and optional `detail`.
 *
 * @example
 * // Get the trigger function from a bProgram instance
 * const { trigger } = bProgram();
 *
 * // Simple event without detail
 * trigger({ type: 'INITIALIZE_APP' });
 *
 * // Event with typed detail payload
 * trigger({
 *   type: 'USER_INPUT',
 *   detail: {
 *     fieldId: 'username',
 *     value: 'johndoe',
 *     timestamp: Date.now()
 *   }
 * });
 *
 */
export type Trigger = <T>(args: BPEvent<T>) => void
/**
 * Factory function that creates and initializes a new behavioral program instance.
 * It returns an immutable object containing the core API for interacting with the program.
 *
 * The behavioral program (BP) is the central coordination mechanism in the BP paradigm.
 * It manages the collection of b-threads, orchestrates their execution, and handles
 * event selection and distribution. This function creates a new, independent instance
 * with its own state and execution context.
 *
 * Each behavioral program operates using a "super-step" execution model:
 * 1. Advance all running threads to their next synchronization point
 * 2. Collect all requested events and filter out blocked ones
 * 3. Select the highest priority event from the remaining candidates
 * 4. Notify relevant threads (waiting for the event, interrupted by it, etc.)
 * 5. Publish the selected event to feedback handlers
 * 6. Begin the next super-step
 *
 * This cycle continues until there are no more events to select or all threads have completed.
 *
 * @returns A readonly object containing the core API for interacting with the program:
 *  - `bThreads`: For managing threads (`set`, `has`) within the program.
 *  - `trigger`: For injecting external events into the program.
 *  - `useFeedback`: For subscribing to selected events with handler functions.
 *  - `useSnapshot`: For monitoring the internal state during execution.
 *
 * @example
 * // Create a new behavioral program instance
 * const { bThreads, trigger, useFeedback, useSnapshot } = bProgram();
 *
 * // Add behavior threads to the program
 * bThreads.set({
 *   'authentication': authenticationRules,
 *   'notifications': notificationRules,
 *   'dataSync': dataSyncRules,
 * });
 *
 * // Set up event handlers for program output
 * useFeedback({
 *   'AUTH_SUCCESS': (userData) => updateUserInterface(userData),
 *   'AUTH_FAILURE': (error) => showLoginError(error),
 *   'NOTIFICATION': (message) => displayNotification(message)
 * });
 *
 * // Add debugging/monitoring if needed
 * if (process.env.NODE_ENV === 'development') {
 *   useSnapshot((snapshot) => {
 *     console.log('Program state:', snapshot);
 *   });
 * }
 *
 * // Start the program with an initial event
 * trigger({ type: 'INITIALIZE' });
 */
export type BProgram = () => Readonly<{
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
export const bProgram: BProgram = () => {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(isTypeOf<BPEventTemplate<any>>(request, 'function') ? { template: request, ...request() } : request),
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
