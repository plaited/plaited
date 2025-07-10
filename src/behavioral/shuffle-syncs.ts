/**
 * @internal
 * @module shuffle-syncs
 *
 * Purpose: Introduces controlled randomness into behavioral thread execution order
 * Architecture: Implements Fisher-Yates shuffle for BSync arrays with in-place mutation
 * Dependencies: b-thread for BSync type definition
 * Consumers: Testing utilities, simulation scenarios, non-deterministic behavioral patterns
 *
 * Maintainer Notes:
 * - This module enables testing of race conditions and non-deterministic scenarios
 * - Fisher-Yates algorithm guarantees uniform distribution of permutations
 * - In-place shuffle modifies the input array for performance
 * - Math.random() is used - not cryptographically secure
 * - Primarily used in test environments, rarely in production
 * - The algorithm runs in O(n) time with O(1) extra space
 *
 * Common modification scenarios:
 * - Supporting seeded randomness: Accept RNG function parameter
 * - Preserving original array: Clone before shuffling
 * - Partial shuffling: Add range parameters
 * - Weighted shuffling: Implement bias based on BSync properties
 *
 * Performance considerations:
 * - In-place mutation avoids array allocation
 * - Single pass through array (O(n) complexity)
 * - No recursion or extra memory needed
 * - Math.random() calls are the main overhead
 *
 * Known limitations:
 * - Not suitable for cryptographic purposes
 * - No seed support for reproducible shuffles
 * - Modifies input array (side effect)
 * - Limited to full array shuffle only
 */
import type { BSync } from './behavioral.js'

/**
 * Randomly shuffles an array of behavioral synchronization points (`BSync`).
 * This utility employs the Fisher-Yates (Knuth) shuffle algorithm to randomize the order
 * of the provided synchronization steps. It's useful for introducing non-determinism
 * into b-threads, often for testing or simulating scenarios where the exact order
 * of operations is not fixed or needs to be varied.
 *
 * @param syncs Rest parameter of `BSync` objects representing the synchronization points to shuffle.
 * @returns A new array containing the same `BSync` objects but in a randomized order.
 * @example
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
