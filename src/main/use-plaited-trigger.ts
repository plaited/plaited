/**
 * @internal
 * @module get-plaited-trigger
 *
 * Purpose: Extends standard triggers with lifecycle management capabilities for Plaited components
 * Architecture: Decorator pattern that augments base triggers with cleanup callback registration
 * Dependencies: b-program for base Trigger and Disconnect types
 * Consumers: bElement, defineBProgram, and any component needing managed resource cleanup
 *
 * Maintainer Notes:
 * - This module solves the critical problem of resource cleanup in component lifecycles
 * - PlaitedTrigger is the primary trigger type used throughout Plaited components
 * - The Set<Disconnect> pattern allows multiple cleanup callbacks without array management
 * - Object.assign is used to mutate the trigger object for performance (single allocation)
 * - Type guard enables conditional cleanup registration in utilities
 *
 * Common modification scenarios:
 * - Adding new lifecycle methods: Extend PlaitedTrigger type and getPlaitedTrigger
 * - Changing cleanup strategy: Modify how disconnectSet is managed
 * - Supporting async cleanup: Update Disconnect type in b-program.js
 *
 * Performance considerations:
 * - Object.assign mutation is intentional - avoids wrapper function overhead
 * - Set operations are O(1) for add/delete
 * - No memory leaks as Set is managed by component lifecycle
 *
 * Known limitations:
 * - Cannot remove individual callbacks once added (by design for simplicity)
 * - Cleanup order is not guaranteed (Set iteration order)
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
 * - Called by bElement during component initialization
 * - Called by defineBProgram for standalone behavioral programs
 * - The disconnectSet is typically managed by the component lifecycle
 * - All callbacks in the set are invoked during component disconnection
 *
 * @see {@link PlaitedTrigger} for the enhanced trigger type
 * @see {@link Disconnect} for cleanup function signature
 * @see {@link bElement} for primary usage in components
 */
export const usePlaitedTrigger = (trigger: Trigger, disconnectSet: Set<Disconnect>) => {
  Object.assign(trigger, {
    addDisconnectCallback: (cb: Disconnect) => disconnectSet.add(cb),
  })
  return trigger as PlaitedTrigger
}
