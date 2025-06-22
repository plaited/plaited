import { type Disconnect, type Trigger, type PlaitedTrigger, isPlaitedTrigger } from '../behavioral.js'

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
 *
 * @example
 * // In your bProgram, when handling an event triggered by useAttributesObserver:
 * //
 * // bProgram({ $, trigger }) {
 * //   // ... setup for observing a slotted element ...
 * //   return {
 * //     attributeChangedOnSlottedElement(detail: ObservedAttributesDetail) {
 * //       console.log(`Attribute '${detail.name}' changed on slotted element.`);
 * //       console.log(`Old value: ${detail.oldValue ?? 'null'}`);
 * //       console.log(`New value: ${detail.newValue ?? 'null'}`);
 * //     }
 * //   };
 * // }
 */
export type ObservedAttributesDetail = {
  oldValue: null | string
  newValue: null | string
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
 * @example Observing attributes on a slotted input element
 * ```tsx
 * import { defineElement, useAttributesObserver, ObservedAttributesDetail } from 'plaited';
 *
 * // Component that observes attributes of an element slotted into it.
 * // This example is inspired by `plaited/src/main/tests/use-attributes-observer.tsx`.
 * const SlottedAttributeMonitor = defineElement({
 *   tag: 'slotted-attribute-monitor',
 *   shadowDom: (
 *     <>
 *       <slot p-target='contentSlot'></slot>
 *       <p>Last change for '<span p-target='attrName'></span>':</p>
 *       <p>Old: <span p-target='attrOldValue'></span></p>
 *       <p>New: <span p-target='attrNewValue'></span></p>
 *     </>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [contentSlot] = $<HTMLSlotElement>('contentSlot');
 *     const [attrNameEl] = $<HTMLSpanElement>('attrName');
 *     const [attrOldValueEl] = $<HTMLSpanElement>('attrOldValue');
 *     const [attrNewValueEl] = $<HTMLSpanElement>('attrNewValue');
 *
 *     // Initialize the observer function. It will dispatch 'slottedAttrUpdate' events.
 *     const observeSlottedAttributes = useAttributesObserver('slottedAttrUpdate', trigger);
 *
 *     // It's best practice to setup observation when slot content changes.
 *     contentSlot.addEventListener('slotchange', () => {
 *       // Get the first element assigned to the slot.
 *       // Real-world scenarios might involve checking element types or multiple elements.
 *       const [slottedElement] = contentSlot.assignedElements();
 *
 *       if (slottedElement) {
 *         // Start observing 'disabled' and 'value' attributes on the slotted element.
 *         // The returned `disconnect` function can be stored for manual cleanup,
 *         // but PlaitedTrigger handles this automatically if used.
 *         const disconnect = observeSlottedAttributes(slottedElement, ['disabled', 'value']);
 *         // For explicit cleanup if needed before component disconnect:
 *         // trigger.addDisconnectCallback(disconnect);
 *         // Or, call disconnect() directly if observation needs to stop early.
 *       } else {
 *         // Handle the case where no element is slotted or it's removed.
 *         console.warn('SlottedAttributeMonitor: No element found in slot to observe.');
 *         attrNameEl.textContent = 'N/A';
 *         attrOldValueEl.textContent = 'N/A';
 *         attrNewValueEl.textContent = 'N/A';
 *       }
 *     });
 *
 *     return {
 *       slottedAttrUpdate(detail: ObservedAttributesDetail) {
 *         attrNameEl.textContent = detail.name;
 *         attrOldValueEl.textContent = detail.oldValue ?? 'null';
 *         attrNewValueEl.textContent = detail.newValue ?? 'null';
 *       }
 *     };
 *   }
 * });
 *
 * // How to use this component:
 * // <slotted-attribute-monitor>
 * //   <input type="text" value="initial" />
 * // </slotted-attribute-monitor>
 * //
 * // If the input's 'value' or 'disabled' attribute is changed programmatically
 * // (e.g., inputElement.setAttribute('value', 'new'); inputElement.toggleAttribute('disabled')),
 * // the SlottedAttributeMonitor component will update its display.
 * ```
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
