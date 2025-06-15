import type { BSync } from './b-thread.js'

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
  for (let i = syncs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[syncs[i], syncs[j]] = [syncs[j], syncs[i]]
  }
  return syncs
}
