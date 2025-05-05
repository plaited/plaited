import type { Disconnect, Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from './plaited.guards.js'

/**
 * Type definition for the detail object dispatched when an observed attribute changes.
 * This is used to track attribute modifications on elements within Plaited components.
 *
 * @property oldValue - Previous value of the attribute, or `null` if newly added
 * @property newValue - Current value of the attribute, or `null` if removed
 * @property name - Name of the attribute that changed
 *
 * @example Using with a Plaited component that tracks aria state changes
 * ```tsx
 * const AriaWatcher = defineElement({
 *   tag: 'aria-watcher',
 *   shadowDom: (
 *     <div>
 *       <button
 *         p-target="button"
 *         aria-expanded="false"
 *       >
 *         Toggle Menu
 *       </button>
 *       <div p-target="status">Watching aria-expanded...</div>
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [button] = $<HTMLButtonElement>('button');
 *     const [status] = $('status');
 *
 *     // Watch for aria-expanded changes
 *     const observeAria = useAttributesObserver('ariaChange', trigger);
 *     observeAria(button, ['aria-expanded']);
 *
 *     return {
 *       ariaChange({ name, oldValue, newValue }: ObservedAttributesDetail) {
 *         status.render(`${name} changed from ${oldValue} to ${newValue}`);
 *       }
 *     };
 *   }
 * });
 * ```
 */
export type ObservedAttributesDetail = {
  oldValue: null | string
  newValue: null | string
  name: string
}

/**
 * Creates a MutationObserver to watch for attribute changes on elements within a Plaited component.
 * When specified attributes change, it triggers an event that can be handled in the component's bProgram.
 *
 * @param eventType - The event type to trigger when attributes change
 * @param trigger - The Plaited trigger function (prefer PlaitedTrigger for automatic cleanup)
 * @returns A function to start observing attributes on a specific element
 *
 * @example Monitoring form field state changes
 * ```tsx
 * const FormField = defineElement({
 *   tag: 'form-field',
 *   shadowDom: (
 *     <div class="field-wrapper">
 *       <input
 *         p-target="input"
 *         type="text"
 *       />
 *       <span p-target="status" class="status"></span>
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [input] = $<HTMLInputElement>('input');
 *     const [status] = $('status');
 *
 *     // Watch for disabled, readonly, and required attributes
 *     const observeField = useAttributesObserver('fieldStateChange', trigger);
 *     observeField(input, ['disabled', 'readonly', 'required']);
 *
 *     return {
 *       fieldStateChange({ name, newValue }: ObservedAttributesDetail) {
 *         const state = newValue === '' ? 'enabled' : 'disabled';
 *         status.render(
 *           <span class={`status-${state}`}>
 *             Field is now {name}: {state}
 *           </span>
 *         );
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example Dynamic ARIA attributes monitoring
 * ```tsx
 * const MenuButton = defineElement({
 *   tag: 'menu-button',
 *   shadowDom: (
 *     <>
 *       <button
 *         p-target="trigger"
 *         aria-expanded="false"
 *         aria-controls="menu"
 *       >
 *         Menu
 *       </button>
 *       <div
 *         id="menu"
 *         p-target="menu"
 *         role="menu"
 *         hidden
 *       >
 *         <slot></slot>
 *       </div>
 *     </>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [triggerBtn] = $<HTMLButtonElement>('trigger');
 *     const [menu] = $('menu');
 *
 *     // Watch both aria-expanded and aria-controls
 *     const observeAria = useAttributesObserver('ariaStateChange', trigger);
 *     observeAria(triggerBtn, ['aria-expanded', 'aria-controls']);
 *
 *     return {
 *       ariaStateChange({ name, newValue }: ObservedAttributesDetail) {
 *         if (name === 'aria-expanded') {
 *           menu.attr('hidden', newValue === 'false');
 *         }
 *       },
 *
 *       TOGGLE_MENU() {
 *         triggerBtn.attr('aria-expanded',
 *           triggerBtn.attr('aria-expanded') === 'true' ? 'false' : 'true'
 *         );
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * - Uses MutationObserver to efficiently track attribute changes
 * - Automatically cleans up when using PlaitedTrigger
 * - Ideal for monitoring ARIA states, form field states, and custom attributes
 * - Works with both host element and elements within the shadow DOM
 * - Can observe multiple attributes simultaneously
 * - Triggers immediately when attributes change via JavaScript or user interaction
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
