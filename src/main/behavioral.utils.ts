/**
 * @internal
 * Utilities for behavioral programming: randomness, type guards, and thread composition.
 * Provides bThread, bSync factories and helpers for non-deterministic scenarios.
 */
import { isTypeOf } from '../utils.ts'
import type { BPEvent, BSync, BThread, PlaitedTrigger, Trigger } from './behavioral.types.ts'

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
     * Non-null assertions safe: loop bounds guarantee valid indices.
     */
    ;[syncs[i], syncs[j]] = [syncs[j]!, syncs[i]!]
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
 * @remarks
 * - Rules are executed sequentially
 * - Repetition is evaluated after completing all rules
 * - Threads can be interrupted mid-sequence
 *
 * @see {@link bSync} for creating individual rules
 * @see {@link RulesFunction} for the generator type
 */
export const bThread: BThread = (rules, repeat) => {
  return repeat
    ? function* () {
        while (isTypeOf<boolean>(repeat, 'boolean') ? repeat : repeat()) {
          const length = rules.length
          for (let i = 0; i < length; i++) {
            yield* rules[i]!()
          }
        }
      }
    : function* () {
        const length = rules.length
        for (let i = 0; i < length; i++) {
          yield* rules[i]!()
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
 */
export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger =>
  Object.hasOwn(trigger, 'addDisconnectCallback')
