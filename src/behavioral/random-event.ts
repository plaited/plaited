import type { BPEvent } from './b-thread.js'

/**
 * Selects and returns a single `BPEvent` object randomly from a provided list of events.
 * This utility is useful for introducing non-determinism into behavioral programs,
 * allowing a b-thread to request or wait for one of several possible events unpredictably.
 *
 * @param events An array of `BPEvent` objects, representing the possible events to choose from.
 * @returns A randomly selected `BPEvent` object from the `events` array.
 * @example
 * import { bSync, bThread, randomEvent } from 'plaited/behavioral';
 *
 * const chooseRandomly = bSync({
 *   // The request will be either { type: 'coin', detail: 'heads' } or { type: 'coin', detail: 'tails' }
 *   request: randomEvent(
 *     { type: 'coin', detail: 'heads' },
 *     { type: 'coin', detail: 'tails' }
 *   )
 * });
 *
 * const randomChoiceThread = bThread([ chooseRandomly ]);
 *
 * // When randomChoiceThread runs, it will request either a 'heads' or 'tails' coin event.
 */
export const randomEvent = (...events: BPEvent[]) => events[Math.floor(Math.random() * Math.floor(events.length))]
