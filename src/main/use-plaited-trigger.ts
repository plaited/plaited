/**
 * @internal
 * @module get-plaited-trigger
 *
 * Extends standard triggers with lifecycle management for BehavioralElements.
 * Decorator pattern augmenting base triggers with cleanup callback registration.
 *
 * @remarks
 * Implementation details:
 * - PlaitedTrigger is the primary trigger type used throughout Plaited
 * - Set pattern for multiple cleanup callbacks without array management
 * - Object.assign mutates trigger for performance (single allocation)
 * - Type guard enables conditional cleanup registration
 *
 * Known limitations:
 * - Cannot remove individual callbacks once added (by design)
 * - Cleanup order not guaranteed (Set iteration order)
 * - No error handling for failed cleanup callbacks
 */
import type { Disconnect, PlaitedTrigger, Trigger } from './behavioral.types.ts'

/**
 * Augments a standard `Trigger` function with the ability to register disconnect callbacks.
 * This function takes a base `Trigger` and a `Set` intended to hold `Disconnect` functions.
 * It adds the `addDisconnectCallback` method to the trigger, which allows consumers
 * to add their cleanup logic (e.g., unsubscribing from listeners, clearing timeouts)
 * to the provided `disconnectSet`.
 *
 * @param trigger - The base `Trigger` function obtained from `bProgram()`
 * @param disconnectSet - A `Set` instance where registered `Disconnect` callbacks will be stored
 * @returns The original `trigger` function, augmented with the `addDisconnectCallback` method
 *
 * @internal
 * Implementation details:
 * - Mutates the original trigger object rather than wrapping it
 * - Uses Object.assign for property addition (faster than spread or proxy)
 * - Type assertion is safe because we just added the required property
 * - Set is passed by reference, allowing external management
 *
 * Integration notes:
 * - Called by bElement during custom element initialization
 * - Called by defineBProgram for standalone behavioral programs
 * - The disconnectSet is typically managed by the custom element lifecycle
 * - All callbacks in the set are invoked during custom element disconnection
 *
 * @see {@link PlaitedTrigger} for the enhanced trigger type
 * @see {@link Disconnect} for cleanup function signature
 * @see {@link bElement} for primary usage in BehavioralElements
 */
export const usePlaitedTrigger = (trigger: Trigger, disconnectSet: Set<Disconnect>) => {
  Object.assign(trigger, {
    addDisconnectCallback: (cb: Disconnect) => disconnectSet.add(cb),
  })
  return trigger as PlaitedTrigger
}
