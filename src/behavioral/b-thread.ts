import { isTypeOf } from '../utils/is-type-of.js'

/**
 * Defines the repetition behavior for a `bThread`.
 * - `true`: The thread repeats indefinitely.
 * - `function`: A predicate function evaluated before each repetition. The thread repeats if the function returns `true`.
 */
type Repeat = true | (() => boolean)

/**
 * Represents a fundamental unit of communication in behavioral programming.
 * An event consists of a mandatory `type` (string identifier) and an optional `detail` payload.
 *
 * @template T The expected type of the `detail` payload. Defaults to `unknown`.
 * @property type - The string identifier for the event.
 * @property detail - Optional data associated with the event.
 * @example
 * const userLoginEvent: BPEvent<{ userId: string }> = { type: 'USER_LOGIN', detail: { userId: 'usr123' } };
 * const simpleEvent: BPEvent = { type: 'SYSTEM_START' };
 */
export type BPEvent<T = unknown> = { type: string; detail?: T }

/**
 * A factory function that generates a `BPEvent`.
 * Useful within `bSync` definitions when the event details might be computed dynamically
 * at the time the synchronization point is reached.
 *
 * @template T The expected type of the `detail` payload for the generated event. Defaults to `unknown`.
 * @returns A `BPEvent<T>` object.
 * @example
 * const createTimestampedEvent = (type: string): BPEventTemplate<{ timestamp: number }> =>
 *   () => ({ type, detail: { timestamp: Date.now() } });
 *
 * bSync({ request: createTimestampedEvent('LOG_TIME') });
 */
export type BPEventTemplate<T = unknown> = () => BPEvent<T>

/**
 * Defines how a b-thread listens for or specifies events in `waitFor`, `block`, or `interrupt` idioms.
 * It can be:
 * 1. A simple `string`: Matches events exactly by their `type`.
 * 2. A predicate function: Takes an event object (`{ type: string, detail: T }`) and returns `true` if the event matches the desired criteria.
 *
 * @template T The expected type of the `detail` payload for events being listened for. Defaults to `unknown`.
 * @example
 * // Listen for event type 'USER_ACTION'
 * const listener1: BPListener = 'USER_ACTION';
 *
 * // Listen for any event whose type starts with 'UI_'
 * const listener2: BPListener = ({ type }) => type.startsWith('UI_');
 *
 * // Listen for 'DATA_LOADED' events with a specific status in the detail
 * const listener3: BPListener<{ status: string }> = ({ type, detail }) =>
 *   type === 'DATA_LOADED' && detail?.status === 'success';
 *
 * bSync({ waitFor: [listener1, listener2], block: listener3 });
 */
export type BPListener<T = unknown> = string | ((args: { type: string; detail: T }) => boolean)

/**
 * Represents a synchronization statement within a b-thread's generator function (`RulesFunction`).
 * It defines the thread's intentions at a specific point in its execution, specifying which events it wants to:
 * - `request`: Propose an event to be selected and triggered by the `bProgram`. Only one request can be active per sync point.
 * - `waitFor`: Wait for specific events to occur. The thread pauses until a matching event is selected.
 * - `block`: Prevent specific events from being selected by the `bProgram` while this sync point is active.
 * - `interrupt`: Specify events that, if selected, will cause the thread to terminate its current execution flow and potentially restart if configured to repeat.
 *
 * Multiple listeners can be provided for `waitFor`, `block`, and `interrupt` using arrays.
 *
 * @template T The expected type of the `detail` payload for events involved in this synchronization point. Defaults to `any` for flexibility, but specific types are recommended.
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
 * It yields `Idioms` objects, representing synchronization points where the thread
 * interacts with the `bProgram` and other threads. The generator pauses at each `yield`
 * and resumes when the `bProgram` selects an event relevant to its `waitFor` or `interrupt` declarations,
 * or when its `request` is selected.
 *
 * @returns A Generator that yields `Idioms` and ultimately returns `void`.
 * @example
 * function* myThreadRules(): RulesFunction {
 *   yield { request: { type: 'INIT' } }; // Request INIT event
 *   yield { waitFor: 'INIT_COMPLETE' }; // Wait for INIT_COMPLETE
 *   console.log('Initialization complete!');
 * }
 */
export type RulesFunction = () => Generator<Idioms, void, undefined>

/**
 * A factory function that creates a single synchronization step (a `RulesFunction`) for a b-thread.
 * It takes an `Idioms` object describing the desired synchronization behavior (request, waitFor, block, interrupt).
 *
 * @template T The type of the event detail payload relevant to this synchronization point.
 * @param arg The `Idioms<T>` object defining the synchronization behavior.
 * @returns A `RulesFunction` (generator function) that yields the provided `Idioms` object once.
 */
export type BSync = <T>(arg: Idioms<T>) => () => Generator<Idioms, void, unknown>

/**
 * A factory function that constructs a complete b-thread (`RulesFunction`) by composing multiple synchronization steps.
 *
 * @param rules An array of `RulesFunction`s, typically created using `bSync`, defining the sequence of steps for the thread.
 * @param repeat Optional configuration (`Repeat`) to control if and how the thread repeats its sequence of rules.
 * @returns A `RulesFunction` representing the combined behavior of the provided rules, potentially repeating.
 */
export type BThread = (rules: RulesFunction[], repeat?: Repeat) => RulesFunction

/**
 * Type guard to check if an unknown value conforms to the `BPEvent` structure.
 * Verifies if the value is an object with a `type` property that is a string.
 *
 * @param data The value to check.
 * @returns `true` if the value is a valid `BPEvent`, `false` otherwise.
 */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}

/**
 * Creates a behavioral thread (b-thread) by combining a sequence of synchronization rules.
 * A b-thread is a generator function (`RulesFunction`) that defines a strand of behavior
 * within a `bProgram`. It yields synchronization points (`Idioms`) to coordinate with other threads.
 *
 * @param rules An array of `RulesFunction`s, usually created with `bSync`, defining the steps of the thread.
 * @param repeat Controls if and how the thread repeats its sequence:
 *   - `true`: Repeats the entire sequence indefinitely.
 *   - `function`: Evaluated before each potential repetition; repeats if it returns `true`.
 *   - `undefined` or `false`: Executes the sequence only once.
 * @returns A `RulesFunction` representing the complete b-thread.
 * @example
 * // Thread that requests 'HOT' then 'COLD', and repeats forever.
 * const hotColdLoop = bThread(
 *   [
 *     bSync({ request: { type: 'HOT' } }),
 *     bSync({ request: { type: 'COLD' } })
 *   ],
 *   true // Repeat indefinitely
 * );
 *
 * // Thread that waits for 'START', then requests 'DONE' once.
 * const startThenDone = bThread(
 *   [
 *     bSync({ waitFor: 'START' }),
 *     bSync({ request: { type: 'DONE' } })
 *   ]
 *   // No repeat argument, runs once.
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
 * This is the fundamental building block yielded by a b-thread's generator function.
 * It encapsulates the thread's intentions (`Idioms`) for a single step of the `bProgram`'s execution cycle.
 *
 * @template T The type of the event detail payload relevant to this synchronization point.
 * @param syncPoint The `Idioms<T>` object defining the thread's request, waitFor, block, and interrupt declarations for this step.
 * @returns A `RulesFunction` (a generator that yields the `syncPoint` once).
 * @example
 * // A synchronization point where the thread requests 'PING'.
 * const requestPing = bSync({ request: { type: 'PING' } });
 *
 * // A synchronization point where the thread waits for 'PONG' and blocks 'TIMEOUT'.
 * const waitPongBlockTimeout = bSync({ waitFor: 'PONG', block: 'TIMEOUT' });
 *
 * function* myThread(): RulesFunction {
 *   yield* requestPing();
 *   yield* waitPongBlockTimeout();
 * }
 */
export const bSync: BSync = (syncPoint) =>
  function* () {
    yield syncPoint
  }
