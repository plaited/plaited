/**
 * @internal
 * @module use-attributes-observer
 *
 * Purpose: Enables reactive monitoring of attribute changes on slotted elements
 * Architecture: Wraps MutationObserver API with Plaited's event system for slot content
 * Dependencies: behavioral module for triggers and lifecycle management
 * Consumers: Components that need to react to attribute changes on projected content
 *
 * Maintainer Notes:
 * - This module solves the problem of observing external element changes in slots
 * - Primary use case is monitoring slotted form elements (input, select, etc.)
 * - MutationObserver is created per observed element, not shared
 * - Automatic cleanup via PlaitedTrigger prevents observer leaks
 * - Event detail provides old/new values for change detection
 * - Designed for slot scenarios where component doesn't control the element
 *
 * Common modification scenarios:
 * - Observing child nodes: Add childList: true to observer config
 * - Batching mutations: Accumulate changes before triggering
 * - Performance optimization: Throttle/debounce rapid mutations
 * - Multiple element observation: Return array of disconnect functions
 *
 * Performance considerations:
 * - MutationObserver is efficient but has overhead per observed element
 * - attributeFilter is critical - observe only necessary attributes
 * - Each mutation triggers synchronous event dispatch
 * - Consider throttling for frequently changing attributes
 *
 * Known limitations:
 * - Only observes attributes, not properties or content
 * - No built-in filtering of programmatic vs user changes
 * - Cannot observe shadow DOM content from light DOM
 * - One observer per element (not optimized for many elements)
 */
import type { Disconnect, PlaitedTrigger, Trigger } from './behavioral.types.ts'
import { isPlaitedTrigger } from './behavioral.utils.ts'

/**
 * Defines the structure of the event detail object dispatched when an observed attribute
 * on a **slotted element** changes. This object provides information about the
 * attribute that was modified.
 *
 * @property oldValue - The previous value of the attribute. It will be `null` if the
 * attribute was newly added or did not have a value previously.
 * @property newValue - The new value of the attribute. It will be `null` if the
 * attribute was removed.
 * @property name - The name of the attribute that changed.
 */
/**
 * @internal
 * Event detail structure for attribute mutations on observed elements.
 * Mirrors MutationRecord data but in a cleaner, typed format.
 */
export type ObservedAttributesDetail = {
  /** Previous attribute value, null if newly added */
  oldValue: null | string
  /** Current attribute value, null if removed */
  newValue: null | string
  /** Name of the changed attribute */
  name: string
}

/**
 * Creates a utility to observe attribute changes on a specified element, which is
 * **primarily intended to be a slotted element** passed into a Plaited component.
 * When any of the designated attributes on the observed slotted element change,
 * a custom event is dispatched via the provided `trigger` function. This event can
 * then be handled within the component's `bProgram`.
 *
 * This utility is particularly useful for components that need to react to changes
 * in the state or properties of content projected into them via slots. For example,
 * a custom wrapper component might observe attributes of a native `<input>` or
 * another custom element slotted into it. It is specifically designed for scenarios
 * involving elements passed through `<slot>`.
 *
 * @param eventType - The `type` for the custom event that will be dispatched when
 * an observed attribute changes. This type is used to identify and handle the
 * event in the `bProgram`.
 * @param trigger - The `trigger` function obtained from the `bProgram`'s arguments.
 * Using a `PlaitedTrigger` (the default from `bProgram`) is highly recommended as it
 * handles automatic cleanup of the underlying `MutationObserver` when the component
 * is disconnected from the DOM, preventing memory leaks.
 * @returns A function that, when called, configures and starts the attribute observation
 * on a specific element. This returned function takes two arguments:
 *   1. `assignedElement: Element`: The slotted element whose attributes are to be observed.
 *      You typically get this from `slotElement.assignedElements()`.
 *   2. `attributeFilter: string[]`: An array of attribute names to observe.
 * The function itself returns a `Disconnect` function, which can be called to
 * manually stop the observation. However, manual disconnection is often unnecessary
 * if `PlaitedTrigger` is used, as it handles cleanup automatically.
 *
 * @remarks
 * - This utility internally uses a `MutationObserver` to efficiently track attribute changes.
 * - It is **specifically designed for observing attributes on elements assigned to a `<slot>`**.
 *   Ensure you correctly access the intended slotted element(s) using `slotElement.assignedElements()`.
 *   This is often best done within a `slotchange` event listener to handle dynamically added or
 *   removed slotted content.
 * - When a `PlaitedTrigger` is used (the default trigger obtained from `bProgram`), the
 *   `MutationObserver` is automatically disconnected when the Plaited component is removed
 *   from the DOM, preventing memory leaks.
 * - The `attributeFilter` option is used with the `MutationObserver`, meaning only changes
 *   to the attributes explicitly listed in this array will trigger an event. This is important
 *   for performance.
 * - The `detail` object of the dispatched event (e.g., `slottedAttrUpdate` in the example)
 *   is of type `ObservedAttributesDetail`, providing the `name` of the changed attribute,
 *   its `oldValue`, and its `newValue`.
 * - While the function returned by `useAttributesObserver` also returns a `disconnect`
 *   function for manual cleanup, relying on `PlaitedTrigger` for automatic cleanup is
 *   generally sufficient and simpler for most use cases within Plaited components.
 */
export const useAttributesObserver = (eventType: string, trigger: PlaitedTrigger | Trigger) => {
  /**
   * @internal
   * Returns a curried function that creates observers for specific elements.
   * This pattern allows reusing the same event type and trigger for multiple elements.
   */
  return (assignedElement: Element, attributeFilter: string[]) => {
    /**
     * @internal
     * Create MutationObserver with callback that converts mutations to Plaited events.
     * Each attribute mutation becomes a separate event for granular handling.
     */
    const mo = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        /**
         * @internal
         * Filter for attribute mutations only (config ensures this).
         * Type check is defensive programming for future config changes.
         */
        if (mutation.type === 'attributes') {
          /**
           * @internal
           * attributeName is guaranteed non-null for attribute mutations.
           * Type assertion is safe based on mutation.type check.
           */
          const name = mutation.attributeName as string

          /**
           * @internal
           * Get current value directly from element.
           * This ensures we have the latest value even if multiple mutations queued.
           */
          const newValue = assignedElement.getAttribute(name)

          /**
           * @internal
           * Dispatch typed event with mutation details.
           * Generic type ensures detail structure matches ObservedAttributesDetail.
           */
          trigger<{ type: string; detail: ObservedAttributesDetail }>({
            type: eventType,
            detail: {
              oldValue: mutation.oldValue,
              name,
              newValue,
            },
          })
        }
      }
    })

    /**
     * @internal
     * Start observation with filtered attributes and old value tracking.
     * attributeOldValue is required for meaningful change detection.
     */
    mo.observe(assignedElement, {
      attributeFilter,
      attributeOldValue: true,
    })

    /**
     * @internal
     * Extract disconnect method and register for automatic cleanup.
     * Method reference is bound to observer instance.
     */
    const disconnect: Disconnect = mo.disconnect
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)

    return disconnect
  }
}
