/**
 * @internal
 * Utilities for behavioral programming: randomness, type guards, and thread composition.
 * Provides bThread, bSync factories and helpers for non-deterministic scenarios.
 */

import * as z from 'zod'
import { isTypeOf } from '../utils.ts'
import { RULES_FUNCTION_IDENTIFIER } from './behavioral.constants.ts'
import type {
  BPEvent,
  BPMatchListener,
  BSync,
  BSyncReplaySafe,
  BSyncVerified,
  BThread,
  BThreadReplaySafe,
  BThreadVerified,
} from './behavioral.types.ts'

/**
 * Creates an event template function that randomly selects from provided events.
 * Returns a template function (`() => BPEvent`) that selects a random event with equal
 * probability each time it's evaluated. This is useful for introducing non-determinism
 * into behavioral programs with repeating threads.
 *
 * The template function uses JavaScript's built-in `Math.random()` to select an event
 * with uniform distribution across all provided options.
 *
 * @param events - Event candidates to choose from when the returned template is evaluated.
 * @returns Event template function that selects one of the provided events when called.
 *
 * @remarks
 * **Why template function?**
 * - Direct call `useRandomEvent(e1, e2)` returns a template function
 * - Template evaluated when sync point is reached → fresh random selection each time
 * - Essential for repeating threads to get different random events per iteration
 *
 * **Use Cases:**
 * - Game mechanics (random enemy behavior, loot drops, procedural generation)
 * - Testing (simulating varied user actions, fuzzing event sequences)
 * - Probabilistic algorithms (Monte Carlo simulations, randomized decision trees)
 * - UI variety (randomize animation sequences, tips, examples)
 *
 * @see {@link shuffleSyncs} for randomizing sync order
 * @see {@link bSync} for creating synchronization points
 */
export const useRandomEvent =
  (...events: BPEvent[]) =>
  () =>
    events[Math.floor(Math.random() * Math.floor(events.length))]

/**
 * Randomly shuffles an array of behavioral synchronization points (`BSync`).
 * This utility employs the Fisher-Yates (Knuth) shuffle algorithm to randomize the order
 * of the provided synchronization steps. It's useful for introducing non-determinism
 * into b-threads, often for testing or simulating scenarios where the exact order
 * of operations is not fixed or needs to be varied.
 *
 * @param syncs - Synchronization points to shuffle in place.
 * @returns The provided synchronization points in randomized order.
 *
 * @remarks
 * - Uses Fisher-Yates shuffle for uniform distribution
 * - Modifies the input array in-place for performance
 * - O(n) time complexity with O(1) extra space
 * - Not cryptographically secure (uses Math.random)
 *
 * @see {@link useRandomEvent} for selecting random events
 * @see {@link bThread} for creating behavioral threads
 */
export const shuffleSyncs = (...syncs: ReturnType<BSync>[]) => {
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
 * @param data - Value to check against the `BPEvent` structure.
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
 * Type guard to check if a value is any Zod schema.
 *
 * @param schema - Value to validate.
 * @returns `true` when `schema` is a Zod schema instance.
 */
const isZodSchema = (schema: unknown): schema is z.ZodTypeAny => schema instanceof z.ZodType

/**
 * Type guard for structured match listeners used in waitFor/block/interrupt idioms.
 *
 * @param data - Value to validate as a `BPMatchListener`.
 * @returns `true` when `data` is a structured match listener.
 */
export const isBPMatchListener = (data: unknown): data is BPMatchListener => {
  if (!isTypeOf<Record<string, unknown>>(data, 'object')) {
    return false
  }
  return (
    data.kind === 'match' &&
    isTypeOf<string>(data.type, 'string') &&
    isZodSchema(data.sourceSchema) &&
    isZodSchema(data.detailSchema)
  )
}

/**
 * Creates a behavioral thread (b-thread) by combining a sequence of synchronization rules.
 * A b-thread is a branded behavioral rule returned by `bThread()` that defines a strand of
 * behavior within a `bProgram`.
 *
 * @param rules - Sequential synchronization steps that define the thread.
 * @param repeat - Controls if and how the thread repeats its sequence.
 * @returns A `ReturnType<BSync>` representing the complete b-thread.
 *
 * @remarks
 * - Rules are executed sequentially
 * - Repetition is evaluated after completing all rules
 * - Threads can be interrupted mid-sequence
 *
 * @see {@link bSync} for creating individual rules
 * @see {@link ReturnType<BSync>} for the branded rule type
 */
export const bThread: BThread = (rules, repeat) => {
  return Object.assign(
    repeat
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
        },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )
}

/**
 * Creates a verifier-safe behavioral thread by combining synchronization rules.
 *
 * @remarks
 * `bThread` remains execution-permissive.
 * `bThreadVerified` is listener-safe (string/match listeners only), not fully replay-safe.
 * Request templates and repeat callbacks remain allowed on this surface.
 * Runtime behavior is intentionally identical to `bThread`.
 */
export const bThreadVerified: BThreadVerified = (rules, repeat) => {
  return Object.assign(
    repeat
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
        },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )
}

/**
 * Creates a replay-safe behavioral thread by combining synchronization rules.
 *
 * @remarks
 * `bThreadReplaySafe` is stricter than `bThreadVerified`:
 * - static requests only (no request template callbacks)
 * - repeat is limited to `true | undefined` (no repeat callbacks)
 * - interrupt remains the lifetime control mechanism
 *
 * Runtime behavior is intentionally identical to `bThread`.
 */
export const bThreadReplaySafe: BThreadReplaySafe = (rules, repeat) => {
  return Object.assign(
    repeat
      ? function* () {
          while (repeat) {
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
        },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )
}

/**
 * Type guard that checks whether an unknown value is a `ReturnType<BSync>` (b-thread or b-sync).
 *
 * @remarks
 * Returns `true` only for branded rule functions created by `bThread`/`bSync`.
 * Arbitrary functions or raw generator functions return `false`.
 *
 * @param obj - The value to test
 * @returns `true` if `obj` is a branded `ReturnType<BSync>`
 *
 * @public
 */
export const isBehavioralRule = (obj: unknown): obj is ReturnType<BSync> =>
  isTypeOf<object>(obj, 'generatorfunction') && '$' in obj && obj.$ === RULES_FUNCTION_IDENTIFIER

/**
 * Creates a single synchronization point for a b-thread.
 * This is the fundamental building block for constructing b-threads.
 *
 * @param syncPoint - `Idioms` object defining the synchronization behavior.
 * @returns Branded behavioral rule representing a single synchronization step.
 *
 * @remarks
 * - Each `bSync` creates one branded behavioral rule step
 * - Can be composed with `bThread` for sequences
 * - Supports all idioms: request, waitFor, block, interrupt
 *
 * @see {@link bThread} for composing multiple sync points
 * @see {@link Idioms} for synchronization options
 */
export const bSync: BSync = (syncPoint) =>
  Object.assign(
    function* () {
      yield syncPoint
    },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )

/**
 * Creates a verifier-safe synchronization point for b-threads.
 *
 * @remarks
 * `bSync` remains execution-permissive.
 * `bSyncVerified` is listener-safe (string/match listeners only), not fully replay-safe.
 * Request templates remain allowed on this surface.
 * Runtime behavior is intentionally identical to `bSync`.
 */
export const bSyncVerified: BSyncVerified = (syncPoint) =>
  Object.assign(
    function* () {
      yield syncPoint
    },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )

/**
 * Creates a replay-safe synchronization point for b-threads.
 *
 * @remarks
 * `bSyncReplaySafe` narrows authoring to static request payloads and listener-safe idioms.
 * Runtime behavior is intentionally identical to `bSync`.
 */
export const bSyncReplaySafe: BSyncReplaySafe = (syncPoint) =>
  Object.assign(
    function* () {
      yield syncPoint
    },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )
