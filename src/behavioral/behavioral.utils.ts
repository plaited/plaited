/**
 * @internal
 * @module behavioral.utils
 *
 * Purpose: Utility functions for introducing randomness and non-determinism in behavioral programs
 * Architecture: Pure functions that operate on behavioral types without side effects
 * Dependencies: behavioral.types for BPEvent and BSync type definitions
 * Consumers: Testing utilities, simulation scenarios, non-deterministic behavioral patterns
 *
 * Maintainer Notes:
 * - This module provides tools for testing race conditions and non-deterministic scenarios
 * - Both functions use Math.random() - not cryptographically secure
 * - Primarily used in test environments, rarely in production
 * - Fisher-Yates algorithm in shuffleSyncs guarantees uniform distribution
 * - randomEvent provides uniform selection from provided options
 *
 * Common modification scenarios:
 * - Supporting seeded randomness: Accept RNG function parameter
 * - Weighted selection: Add probability weights to randomEvent
 * - Partial shuffling: Add range parameters to shuffleSyncs
 * - Cryptographic randomness: Replace Math.random with crypto API
 *
 * Performance considerations:
 * - Both functions are O(n) where n is input size
 * - In-place mutation in shuffleSyncs avoids allocation
 * - No recursion or significant memory overhead
 * - Math.random() calls are the main performance cost
 *
 * Known limitations:
 * - Not suitable for cryptographic purposes
 * - No seed support for reproducible randomness
 * - shuffleSyncs modifies input array (side effect)
 * - No built-in support for weighted probabilities
 */
import { isTypeOf } from '../utils.js'
import type { BPEvent, BSync, BThread, Trigger, PlaitedTrigger } from './behavioral.types.js'

/**
 * Selects and returns a single `BPEvent` object randomly from a provided list of events.
 * This utility is useful for introducing non-determinism into behavioral programs,
 * allowing a b-thread to request one of several possible events unpredictably.
 *
 * The function uses JavaScript's built-in `Math.random()` to select an event with equal
 * probability for each option. This creates a uniform distribution across all provided events.
 *
 * Common use cases include:
 * - Simulating random user behavior in testing scenarios
 * - Implementing game mechanics with randomized outcomes
 * - Creating varied system responses to enhance user experience
 * - Building probabilistic algorithms within behavioral programs
 *
 * @param events Rest parameter of `BPEvent` objects, representing the possible events to choose from.
 *   Can include any number of events, but at least one should be provided to avoid undefined returns.
 * @returns A randomly selected `BPEvent` object from the provided events.
 * @throws Will not throw errors, but returns `undefined` if called with no arguments.
 *
 * @example Basic coin flip
 * ```ts
 * import { bSync, bThread, randomEvent } from 'plaited/behavioral';
 *
 * // Basic usage - randomly choose between two events
 * const flipCoin = bSync({
 *   request: randomEvent(
 *     { type: 'COIN', detail: 'heads' },
 *     { type: 'COIN', detail: 'tails' }
 *   )
 * });
 * ```
 *
 * @example Simulating user actions
 * ```ts
 * // More complex example - simulate random user actions
 * const randomUserAction = bSync({
 *   request: randomEvent(
 *     { type: 'USER_ACTION', detail: { action: 'click', target: 'button' } },
 *     { type: 'USER_ACTION', detail: { action: 'scroll', distance: 100 } },
 *     { type: 'USER_ACTION', detail: { action: 'type', text: 'Hello' } },
 *     { type: 'USER_ACTION', detail: { action: 'navigate', to: '/home' } }
 *   )
 * });
 *
 * // Using in a full b-thread with repetition
 * const randomActionSimulator = bThread(
 *   [randomUserAction],
 *   true // Repeat indefinitely
 * );
 * ```
 *
 * @example Weighted random selection
 * ```ts
 * // Can also be used for weighted random choices by duplicating events
 * // Here "success" has a 2/3 probability, "failure" has 1/3
 * const weightedOutcome = randomEvent(
 *   { type: 'OUTCOME', detail: 'success' },
 *   { type: 'OUTCOME', detail: 'success' }, // Duplicated to increase probability
 *   { type: 'OUTCOME', detail: 'failure' }
 * );
 * ```
 *
 * @see {@link shuffleSyncs} for randomizing sync order
 * @see {@link bSync} for creating synchronization points
 */
export const randomEvent = (...events: BPEvent[]) => events[Math.floor(Math.random() * Math.floor(events.length))]

/**
 * Randomly shuffles an array of behavioral synchronization points (`BSync`).
 * This utility employs the Fisher-Yates (Knuth) shuffle algorithm to randomize the order
 * of the provided synchronization steps. It's useful for introducing non-determinism
 * into b-threads, often for testing or simulating scenarios where the exact order
 * of operations is not fixed or needs to be varied.
 *
 * @param syncs Rest parameter of `BSync` objects representing the synchronization points to shuffle.
 * @returns A new array containing the same `BSync` objects but in a randomized order.
 *
 * @example Randomizing execution order
 * ```ts
 * import { bSync, bThread, shuffleSyncs } from 'plaited/behavioral';
 *
 * const randomOrderThread = bThread(
 *   shuffleSyncs(
 *     bSync({ request: { type: 'stepA' } }),
 *     bSync({ request: { type: 'stepB' } }),
 *     bSync({ request: { type: 'stepC' } })
 *   )
 * );
 *
 * // The order in which 'stepA', 'stepB', and 'stepC' are requested
 * // by randomOrderThread will vary each time the thread runs.
 * ```
 *
 * @example Testing race conditions
 * ```ts
 * // Test different initialization orders
 * const initThread = bThread(
 *   shuffleSyncs(
 *     bSync({ request: { type: 'LOAD_CONFIG' } }),
 *     bSync({ request: { type: 'CONNECT_DB' } }),
 *     bSync({ request: { type: 'INIT_CACHE' } }),
 *     bSync({ request: { type: 'START_SERVER' } })
 *   )
 * );
 *
 * // Each test run will try a different initialization order
 * // helping identify order-dependent bugs
 * ```
 *
 * @remarks
 * - Uses Fisher-Yates shuffle for uniform distribution
 * - Modifies the input array in-place for performance
 * - O(n) time complexity with O(1) extra space
 * - Not cryptographically secure (uses Math.random)
 *
 * @see {@link randomEvent} for selecting random events
 * @see {@link bThread} for creating behavioral threads
 */
export const shuffleSyncs = (...syncs: BSync[]) => {
  /**
   * @internal
   * Fisher-Yates shuffle implementation working backwards through array.
   * Each iteration selects random element from unshuffled portion.
   *
   * Algorithm invariant: After iteration i, elements at positions > i are randomly shuffled.
   * Time complexity: O(n) where n is array length
   * Space complexity: O(1) - in-place swap
   */
  for (let i = syncs.length - 1; i > 0; i--) {
    /**
     * @internal
     * Generate random index from 0 to i (inclusive).
     * Math.floor ensures integer result for array indexing.
     * Distribution is uniform assuming Math.random() quality.
     */
    const j = Math.floor(Math.random() * (i + 1))

    /**
     * @internal
     * ES6 destructuring swap - no temporary variable needed.
     * Semicolon prefix prevents ASI issues with array destructuring.
     */
    ;[syncs[i], syncs[j]] = [syncs[j], syncs[i]]
  }

  return syncs
}

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
 * Type guard to identify enhanced Plaited triggers with disconnect capability.
 * Used internally by the framework to ensure proper cleanup of component resources.
 *
 * @internal
 * @param trigger - The trigger function to check
 * @returns True if the trigger includes disconnect callback support
 *
 * Implementation notes:
 * - Uses Object.hasOwn for robust property checking (not affected by prototype)
 * - Critical for conditional cleanup registration in utilities
 * - Allows graceful handling of both trigger types in the codebase
 *
 * @example Using in a custom effect implementation
 * ```tsx
 * const useCustomEffect = (trigger: Trigger | PlaitedTrigger, callback: () => () => void) => {
 *   if (isPlaitedTrigger(trigger)) {
 *     const cleanup = callback();
 *     // Register cleanup function to run on component disconnect
 *     trigger.addDisconnectCallback(cleanup);
 *   }
 * };
 *
 * // Usage in a component
 * const MyComponent = bElement({
 *   tag: 'my-component',
 *   shadowDom: <div p-target="root" />,
 *   bProgram({ trigger }) {
 *     useCustomEffect(trigger, () => {
 *       const interval = setInterval(() => console.log('tick'), 1000);
 *       return () => clearInterval(interval);
 *     });
 *   }
 * });
 * ```
 */
export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger =>
  Object.hasOwn(trigger, 'addDisconnectCallback')
