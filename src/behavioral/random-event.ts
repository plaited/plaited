import type { BPEvent } from './b-thread.js'

/**
 * Creates an event template that randomly selects one event from a provided list.
 * Useful for non-deterministic behavior in behavioral programming scenarios.
 * @param events List of possible behavioral events to choose from
 * @returns A randomly selected event from the input list
 * @example
 * const event = randomEvent(
 *   { type: 'EVENT_A', detail: 'a' },
 *   { type: 'EVENT_B', detail: 'b' }
 * );
 */
export const randomEvent = (...events: BPEvent[]) => events[Math.floor(Math.random() * Math.floor(events.length))]
