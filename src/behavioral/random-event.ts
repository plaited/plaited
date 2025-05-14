import type { BPEvent } from './b-thread.js'

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
 * @param events A spread array of `BPEvent` objects, representing the possible events to choose from.
 *   Can include any number of events, but at least one should be provided to avoid undefined returns.
 * @returns A randomly selected `BPEvent` object from the provided events.
 * @throws Will not throw errors, but returns `undefined` if called with no arguments.
 *
 * @example
 * import { bSync, bThread, randomEvent } from 'plaited/behavioral';
 *
 * // Basic usage - randomly choose between two events
 * const flipCoin = bSync({
 *   request: randomEvent(
 *     { type: 'COIN', detail: 'heads' },
 *     { type: 'COIN', detail: 'tails' }
 *   )
 * });
 *
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
 *
 * // Can also be used for weighted random choices by duplicating events
 * // Here "success" has a 2/3 probability, "failure" has 1/3
 * const weightedOutcome = randomEvent(
 *   { type: 'OUTCOME', detail: 'success' },
 *   { type: 'OUTCOME', detail: 'success' }, // Duplicated to increase probability
 *   { type: 'OUTCOME', detail: 'failure' }
 * );
 */
export const randomEvent = (...events: BPEvent[]) => events[Math.floor(Math.random() * Math.floor(events.length))]
