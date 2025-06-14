/**
 * Demonstrates attribute change observation in Plaited components.
 * Provides a way to react to element attribute changes using the useAttributesObserver hook.
 *
 * Features:
 * - Attribute change detection
 * - Automatic cleanup
 * - Multiple attribute observation
 * - Type-safe change events
 *
 * @example
 * ```tsx
 * const AttributeWatcher = defineElement({
 *   tag: 'attribute-watcher',
 *   shadowDom: (
 *     <div>
 *       <slot p-target="content" />
 *       <div p-target="status" />
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [slot] = $<HTMLSlotElement>('content');
 *     const [el] = slot.assignedElements();
 *
 *     const observer = useAttributesObserver('change', trigger);
 *     observer(el, ['aria-label', 'disabled']);
 *
 *     return {
 *       change({ name, oldValue, newValue }) {
 *         const [status] = $('status');
 *         status.render(
 *           `Changed: ${name} from ${oldValue} to ${newValue}`
 *         );
 *       }
 *     };
 *   }
 * });
 * ```
 */

import { defineElement, useAttributesObserver } from 'plaited'

export const AttributesObserver = defineElement({
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
    observe(el, ['disabled', 'value'])
    return {
      change(detail: { name: string; oldValue: string | null; newValue: string | null }) {
        name.render(detail.name)
        oldValue.render(detail.oldValue ?? 'null')
        newValue.render(detail.newValue ?? 'null')
      },
    }
  },
})
