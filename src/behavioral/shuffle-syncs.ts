import type { BSync } from './b-thread.js'

/**
 * Randomly reorders a sequence of behavioral synchronization points.
 * Uses Fisher-Yates shuffle algorithm to create non-deterministic execution order.
 * @param syncs Array of behavioral synchronization functions to be shuffled
 * @returns The same synchronization functions in a randomized order
 * @example
 * const shuffledSequence = shuffleSyncs(
 *   bSync({ request: { type: 'event1' } })
 *   bSync({ request: { type: 'event2' } }),
 *   bSync({ request: { type: 'event3' } }),
 * );
 * // Returns the same syncs in random order
 */
export const shuffleSyncs = (...syncs: BSync[]) => {
  for (let i = syncs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[syncs[i], syncs[j]] = [syncs[j], syncs[i]]
  }
  return syncs
}
