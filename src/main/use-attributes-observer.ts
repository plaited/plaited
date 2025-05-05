import type { Disconnect, Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from './plaited.guards.js'

/**
 * @description Type definition for the detail object dispatched when an observed attribute changes.
 *
 * @property {string | null} oldValue - The value of the attribute before the change, or `null` if the attribute was newly added.
 * @property {string | null} newValue - The new value of the attribute, or `null` if the attribute was removed.
 * @property {string} name - The name of the attribute that changed.
 *
 * @example
 * ```typescript
 * // Example detail object for a 'class' attribute change
 * const detail: ObservedAttributesDetail = {
 *   oldValue: "button",
 *   newValue: "button active",
 *   name: "class"
 * };
 *
 * // Example detail object for adding a 'disabled' attribute
 * const detailAdded: ObservedAttributesDetail = {
 *   oldValue: null,
 *   newValue: "", // Boolean attributes often have an empty string value when present
 *   name: "disabled"
 * };
 *
 * // Example detail object for removing a 'data-id' attribute
 * const detailRemoved: ObservedAttributesDetail = {
 *   oldValue: "user-123",
 *   newValue: null,
 *   name: "data-id"
 * };
 * ```
 */
export type ObservedAttributesDetail = {
  oldValue: null | string
  newValue: null | string
  name: string
}

/**
 * @description A hook that creates a `MutationObserver` specifically configured to watch for attribute changes on a target element.
 * When specified attributes change, it dispatches an event using the provided Plaited trigger function.
 * It automatically handles observer disconnection when the component is disconnected (if using `PlaitedTrigger`).
 *
 * @param {string} eventType - The `type` of the event to dispatch via the trigger function when an attribute changes.
 * @param {PlaitedTrigger | Trigger} trigger - The Plaited trigger function (`PlaitedTrigger` preferred for auto-cleanup) or a standard `Trigger` function used to dispatch the event.
 * @returns {(assignedElement: Element, attributeFilter: string[]) => Disconnect} A function that, when called:
 *   - Takes the target `assignedElement` (the element to observe) and an array `attributeFilter` (the names of attributes to watch).
 *   - Starts the `MutationObserver`.
 *   - Returns a `Disconnect` function that can be manually called to stop the observer. Auto disconnects is handled if using `PlaitedTrigger`.
 *
 * @example Usage within a Plaited component's bProgram
 * ```typescript
 * import { defineElement, useAttributesObserver, h, type ObservedAttributesDetail } from 'plaited';
 *
 * export const AttributeWatcher = defineElement({
 *   tag: 'attribute-watcher',
 *   shadowDom: (
 *     <>
 *       <slot p-target="slot"></slot>
 *       <p>Last change:</p>
 *       <pre p-target="output">No changes yet.</pre>
 *     </>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [slotEl] = $<HTMLSlotElement>('slot');
 *     const [outputEl] = $<HTMLPreElement>('output');
 *
 *     // Get the function to start observing
 *     const observeAttributes = useAttributesObserver('attributeChanged', trigger);
 *
 *     return {
 *       attributeChanged(detail: ObservedAttributesDetail) {
 *         outputEl.render(JSON.stringify(detail, null, 2));
 *       },
 *     };
 *   },
 * });
 *
 * // Example HTML usage:
 * // <attribute-watcher>
 * //   <div class="initial" data-state="idle">Observed Element</div>
 * // </attribute-watcher>
 * // Changing the class or data-state of the inner div will trigger 'attributeChanged'.
 * ```
 *
 * @remarks
 * - Leverages the `MutationObserver` API.
 * - Filters observations to only the specified `attributeFilter`.
 * - Includes `attributeOldValue: true` in the observer options, providing the `oldValue` in the detail.
 * - If a `PlaitedTrigger` is provided, the observer's `disconnect` method is automatically added to the trigger's disconnect callbacks, ensuring cleanup when the component disconnects. If a standard `Trigger` is used, manual disconnection (e.g., in `onDisconnected`) is recommended.
 */
export const useAttributesObserver = (eventType: string, trigger: PlaitedTrigger | Trigger) => {
  return (assignedElement: Element, attributeFilter: string[]) => {
    const mo = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes') {
          const name = mutation.attributeName as string
          const newValue = assignedElement.getAttribute(name)
          trigger<ObservedAttributesDetail>({
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
    mo.observe(assignedElement, {
      attributeFilter,
      attributeOldValue: true,
    })
    const disconnect: Disconnect = mo.disconnect
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
}
