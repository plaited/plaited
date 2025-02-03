import type { Disconnect, Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from './plaited.guards.js'

/**
 * Type definition for attribute change notifications.
 * Captures the details of an attribute mutation.
 *
 * @property oldValue Previous attribute value or null if not set
 * @property newValue Current attribute value or null if removed
 * @property name Name of the changed attribute
 *
 * @example
 * type Detail = {
 *   oldValue: "previous-class",
 *   newValue: "new-class",
 *   name: "class"
 * }
 */
export type ObservedAttributesDetail = {
  oldValue: null | string
  newValue: null | string
  name: string
}
/**
 * Creates an attribute observer that triggers events on attribute changes.
 * Provides automatic cleanup and mutation tracking.
 *
 * @param eventType Type of event to trigger on attribute changes
 * @param trigger Function to dispatch events
 * @returns Function to set up observation on an element
 *
 * Features:
 * - Automatic disconnect handling
 * - Filtered attribute observation
 * - Old value tracking
 * - Event-based notification
 *
 * @example
 * const observe = useAttributesObserver('EVENT', trigger);
 *
 * // Start observing specific attributes
 * const disconnect = observe(element, ['class', 'data-state']);
 *
 * // Later: cleanup
 * disconnect();
 *
 * @example Event Handling
 import { defineTemplate, useAttributesObserver } from 'plaited'

 export const AttributesObserver = defineTemplate({
   tag: 'attribute-observer',
   shadowDom: (
     <>
       <slot p-target='slot'></slot>
       <p p-target='name'></p>
       <p p-target='oldValue'></p>
       <p p-target='newValue'></p>
     </>
   ),
   bProgram({ $, trigger }) {
     const [slot] = $<HTMLSlotElement>('slot')
     const [name] = $<HTMLSpanElement>('name')
     const [oldValue] = $<HTMLSpanElement>('oldValue')
     const [newValue] = $<HTMLSpanElement>('newValue')
     const [el] = slot.assignedElements()
     const observe = useAttributesObserver('change', trigger)
     const disconnectObserver = observe(el, ['disabled', 'value'])
     return {
       change(detail: { name: string; oldValue: string | null; newValue: string | null }) {
         name.render(detail.name)
         oldValue.render(detail.oldValue ?? 'null')
         newValue.render(detail.newValue ?? 'null')
       },
       onDisconnected(){
        disconnectObserver()
       }
     }
   },
 })
 *
 * @remarks
 * - Uses MutationObserver internally
 * - Automatically manages observer lifecycle
 * - Supports Plaited trigger system
 * - Provides type-safe event details
 * - Handles cleanup via disconnect callbacks
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
