import { isTypeOf } from '../utils/is-type-of.js'

/**
 * Defines the repetition behavior for a `bThread`.
 * - `true`: The thread repeats indefinitely.
 * - `function`: A predicate function evaluated before each repetition. The thread repeats if the function returns `true`.
 * - `undefined` or omitted: The thread executes once and terminates.
 *
 * @example
 * // Repeat indefinitely
 * bThread([...rules], true);
 *
 * // Repeat until counter reaches 5
 * let counter = 0;
 * bThread([...rules], () => counter++ < 5);
 */
type Repeat = true | (() => boolean)

/**
 * Represents a fundamental unit of communication in behavioral programming.
 * An event consists of a mandatory `type` (string identifier) and an optional `detail` payload.
 * Events are used for communication between b-threads and are the core mechanism
 * through which the behavioral program coordinates execution.
 *
 * @template T The expected type of the `detail` payload. Defaults to `unknown`.
 * @property type - The string identifier for the event, used for matching and dispatching.
 * @property detail - Optional data payload associated with the event.
 * @example
 * // Event with typed detail payload
 * const userLoginEvent: BPEvent<{ userId: string; timestamp: number }> = {
 *   type: 'USER_LOGIN',
 *   detail: { userId: 'usr123', timestamp: Date.now() }
 * };
 *
 * // Simple event without detail
 * const simpleEvent: BPEvent = { type: 'SYSTEM_START' };
 */
export type BPEvent<T = unknown> = { type: string; detail?: T }

/**
 * A factory function that generates a `BPEvent` dynamically.
 * Particularly useful within `bSync` definitions when the event details need to be computed
 * at the exact moment the synchronization point is reached rather than when the b-thread
 * is initially defined.
 *
 * @template T The expected type of the `detail` payload for the generated event. Defaults to `unknown`.
 * @returns A `BPEvent<T>` object when the function is invoked.
 * @example
 * // Create a factory for timestamped events
 * const createTimestampedEvent = (type: string): BPEventTemplate<{ timestamp: number }> =>
 *   () => ({ type, detail: { timestamp: Date.now() } });
 *
 * // Used in a bSync to generate a fresh timestamp each time this sync point is reached
 * bSync({ request: createTimestampedEvent('LOG_TIME') });
 *
 * // Useful for dynamic data in requests
 * let counter = 0;
 * const createCounterEvent = (): BPEventTemplate<{ count: number }> =>
 *   () => ({ type: 'COUNT', detail: { count: counter++ } });
 */
export type BPEventTemplate<T = unknown> = () => BPEvent<T>

/**
 * Defines how a b-thread listens for or specifies events in `waitFor`, `block`, or `interrupt` idioms.
 * This type provides a flexible way to match events based on simple string identifiers or complex conditions.
 *
 * It can be one of:
 * 1. A simple `string`: Matches events exactly by their `type` property.
 * 2. A predicate function: Takes an event object and returns `true` if the event matches the desired criteria.
 *
 * @template T The expected type of the `detail` payload for events being listened for. Defaults to `unknown`.
 * @example
 * // Simple string match - listens for exactly "USER_ACTION" events
 * const listener1: BPListener = 'USER_ACTION';
 *
 * // Pattern matching - listens for any events with types starting with "UI_"
 * const listener2: BPListener = ({ type }) => type.startsWith('UI_');
 *
 * // Content-based filtering - listens for specific data in the event
 * const listener3: BPListener<{ status: string }> = ({ type, detail }) =>
 *   type === 'DATA_LOADED' && detail?.status === 'success';
 *
 * // Used in a synchronization point
 * bSync({
 *   waitFor: [listener1, listener2], // Thread will resume on any matching event
 *   block: listener3                 // Thread prevents these events from occurring
 * });
 */
export type BPListener<T = unknown> = string | ((args: { type: string; detail: T }) => boolean)

/**
 * Represents a synchronization statement within a b-thread's generator function (`RulesFunction`).
 * This is the core mechanism through which b-threads communicate their behavioral intentions
 * to the behavioral program scheduler at each step of execution.
 *
 * An `Idioms` object declares what the thread intends to do at a specific synchronization point:
 *
 * - `request`: Propose an event to be selected and triggered by the `bProgram`.
 *   Only one request can be active per sync point. A request is not guaranteed to be selected
 *   immediately or at all, as it may be blocked by other threads.
 *
 * - `waitFor`: Wait for specific events to occur. The thread pauses at this sync point
 *   until a matching event is selected by the program. If multiple events are specified,
 *   the thread will resume when any one of them occurs.
 *
 * - `block`: Prevent specific events from being selected by the `bProgram` while this sync point
 *   is active. This has higher precedence than requests - a blocked event cannot be selected
 *   even if requested by other threads.
 *
 * - `interrupt`: Specify events that, if selected, will cause the thread to terminate
 *   its current execution flow and potentially restart if configured to repeat. This is useful
 *   for cancellation patterns and exceptional workflows.
 *
 * Multiple listeners can be provided for `waitFor`, `block`, and `interrupt` using arrays.
 *
 * @template T The expected type of the `detail` payload for events involved in this synchronization point.
 *   Defaults to `any` for flexibility, but specific types are recommended for type safety.
 *
 * @example
 * // Wait for a user login, block timeouts, and request a session initialization
 * yield {
 *   waitFor: 'USER_LOGIN',
 *   block: 'SESSION_TIMEOUT',
 *   request: { type: 'INITIALIZE_SESSION' }
 * };
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Idioms<T = any> = {
  /** Event(s) the thread is waiting for. Execution pauses until a matching event is selected. */
  waitFor?: BPListener<T> | BPListener<T>[]
  /** Event(s) that will interrupt the thread's execution if selected. */
  interrupt?: BPListener<T> | BPListener<T>[]
  /** An event the thread wishes to request. Can be a static event object or a template function. */
  request?: BPEvent<T> | BPEventTemplate<T>
  /** Event(s) the thread wants to prevent from being selected. */
  block?: BPListener<T> | BPListener<T>[]
}

/**
 * A generator function defining the behavior of a b-thread.
 * This is the fundamental unit of behavior in the BP (Behavioral Programming) paradigm,
 * representing a sequential process that can synchronize with other b-threads.
 *
 * The generator yields `Idioms` objects, representing synchronization points where the thread
 * interacts with the `bProgram` and other threads. The execution flow works as follows:
 *
 * 1. The thread yields an `Idioms` object to declare its intentions
 * 2. The generator pauses, transferring control to the behavioral program scheduler
 * 3. The scheduler selects an event based on all active threads' declarations
 * 4. The thread resumes when:
 *    - An event matching its `waitFor` declaration is selected
 *    - Its `request` is selected by the scheduler
 *    - An event matching its `interrupt` declaration is selected (terminating the thread)
 *
 * @returns A Generator that yields `Idioms` objects at synchronization points and ultimately returns `void`.
 * @example
 * function* loginSequence(): RulesFunction {
 *   // Request a login form to be displayed
 *   yield { request: { type: 'SHOW_LOGIN_FORM' } };
 *
 *   // Wait for either a login success or cancellation
 *   yield { waitFor: ['LOGIN_SUCCESS', 'LOGIN_CANCELLED'] };
 *
 *   // Get the selected event to determine which path to take
 *   const event = yield { waitFor: ['LOGIN_SUCCESS', 'LOGIN_CANCELLED'] };
 *
 *   if (event.type === 'LOGIN_SUCCESS') {
 *     yield { request: { type: 'NAVIGATE_TO_DASHBOARD' } };
 *   } else {
 *     yield { request: { type: 'RETURN_TO_HOME' } };
 *   }
 * }
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
export type BSync = <T>(arg: Idioms<T>) => () => Generator<Idioms, void, unknown>

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
 * @returns `true` if the value is a valid `BPEvent` (has an object structure with a string `type` property), `false` otherwise.
 *
 * @example
 * function processEvent(possibleEvent: unknown) {
 *   if (isBPEvent(possibleEvent)) {
 *     // TypeScript now knows this is a BPEvent
 *     console.log(`Processing event: ${possibleEvent.type}`);
 *     return true;
 *   }
 *   return false;
 * }
 */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}

/**
 * Creates a behavioral thread (b-thread) by combining a sequence of synchronization rules.
 * A b-thread is a generator function (`RulesFunction`) that defines a strand of behavior
 * within a `bProgram`. It yields synchronization points (`Idioms`) to coordinate with other threads.
 *
 * This function provides a convenient way to compose multiple synchronization steps (`bSync` outputs)
 * into a cohesive behavior unit, with optional repetition capabilities.
 *
 * @param rules An array of `RulesFunction`s, usually created with `bSync`, defining the sequential steps of the thread.
 * @param repeat Controls if and how the thread repeats its sequence:
 *   - `true`: Repeats the entire sequence indefinitely.
 *   - `function`: Evaluated before each potential repetition; repeats if it returns `true`.
 *   - `undefined` or `false`: Executes the sequence only once.
 * @returns A `RulesFunction` representing the complete b-thread that can be added to a behavioral program.
 *
 * @example
 * // Thread that requests 'HOT' then 'COLD', and repeats forever
 * const hotColdLoop = bThread(
 *   [
 *     bSync({ request: { type: 'HOT' } }),
 *     bSync({ request: { type: 'COLD' } })
 *   ],
 *   true // Repeat indefinitely
 * );
 *
 * // Thread that waits for 'START', then requests 'DONE' once
 * const startThenDone = bThread([
 *   bSync({ waitFor: 'START' }),
 *   bSync({ request: { type: 'DONE' } })
 * ]);
 *
 * // Thread that repeats for a fixed number of times
 * let counter = 0;
 * const countToFive = bThread(
 *   [
 *     bSync({ request: { type: 'COUNT', detail: { value: counter } } })
 *   ],
 *   () => counter++ < 5 // Repeat until counter reaches 5
 * );
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
 * Creates a single synchronization point (`RulesFunction`) for a b-thread.
 * This is the fundamental building block for constructing b-threads - it creates a reusable,
 * single-step generator that represents one synchronization point in a thread's execution.
 *
 * The `bSync` function enables a more declarative style of defining b-threads by allowing
 * synchronization points to be defined outside generator functions and composed together.
 *
 * @template T The type of the event detail payload relevant to this synchronization point.
 * @param syncPoint The `Idioms<T>` object defining the thread's request, waitFor, block, and interrupt declarations for this step.
 * @returns A `RulesFunction` (a generator that yields the `syncPoint` once).
 *
 * @example
 * // Define reusable synchronization points
 * const requestPing = bSync({ request: { type: 'PING' } });
 * const waitForPong = bSync({ waitFor: 'PONG' });
 * const blockTimeout = bSync({ block: 'TIMEOUT' });
 *
 * // Use directly in a generator function with yield*
 * function* pingPongThread(): RulesFunction {
 *   while (true) {
 *     yield* requestPing();
 *     yield* bSync({ waitFor: 'PONG', block: 'TIMEOUT' }); // Inline usage
 *   }
 * }
 *
 * // Or compose with bThread
 * const simplePingPong = bThread([
 *   requestPing,
 *   waitForPong
 * ], true); // Repeat indefinitely
 *
 * // Combined idioms in a single sync point
 * const complexSync = bSync({
 *   request: { type: 'START_PROCESS', detail: { id: 'proc-123' } },
 *   waitFor: ['PROCESS_STARTED', 'PROCESS_FAILED'],
 *   block: ({ type }) => type.startsWith('INTERRUPT_'),
 *   interrupt: 'EMERGENCY_SHUTDOWN'
 * });
 */
export const bSync: BSync = (syncPoint) =>
  function* () {
    yield syncPoint
  }
