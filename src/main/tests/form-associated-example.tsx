/**
 * Example of creating a form-associated custom element with Plaited.
 * Demonstrates how to create form controls that integrate with native form handling.
 *
 * Features:
 * - Form association
 * - State management
 * - Value synchronization
 * - Form validation
 * - Disabled state handling
 *
 * @example
 * ```tsx
 * const CustomInput = defineElement({
 *   tag: 'custom-input',
 *   formAssociated: true,
 *   shadowDom: (
 *     <div>
 *       <input
 *         p-target="input"
 *         p-trigger={{ input: 'valueChanged' }}
 *       />
 *       <span p-target="error" />
 *     </div>
 *   ),
 *   bProgram({ $, internals }) {
 *     return {
 *       valueChanged({ target }) {
 *         const value = target.value;
 *         internals.setFormValue(value);
 *         internals.setValidity(
 *           { valueMissing: !value },
 *           'This field is required'
 *         );
 *       }
 *     };
 *   }
 * });
 *
 * // Usage in a form
 * const MyForm = () => (
 *   <form>
 *     <CustomInput name="field" required />
 *   </form>
 * );
 * ```
 */

import { defineElement, css } from 'plaited'
import { isTypeOf } from 'plaited/utils'

const styles = css.create({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: 'var(--fill)',
    gridArea: 'input',
  },
})

const hostStyles = css.host({
  display: 'inline-grid',
  '--fill': {
    default: 'lightblue',
    ':state(checked)': 'blue',
    ':state(disabled)': 'grey',
  },
})

export const ToggleInput = defineElement<{
  click(evt: MouseEvent & { target: HTMLInputElement }): void
  checked(val: boolean): void
  disabled(val: boolean): void
  valueChange(val: string | null): void
}>({
  tag: 'toggle-input',
  observedAttributes: ['disabled', 'checked', 'value'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='symbol'
      {...css.assign(styles.symbol, hostStyles)}
      p-trigger={{ click: 'click' }}
    />
  ),
  bProgram({ trigger, internals, root, bThreads, bSync, bThread }) {
    bThreads.set({
      onDisabled: bThread(
        [
          bSync({
            block: [
              ({ type }) => type === 'checked' && internals.states.has('disabled'),
              ({ type }) => type === 'valueChange' && internals.states.has('disabled'),
            ],
          }),
        ],
        true,
      ),
    })
    return {
      click() {
        trigger({ type: 'checked', detail: !internals.states.has('checked') })
      },
      checked(val) {
        root.host.toggleAttribute('checked', val)
        if (val) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        } else {
          internals.states.delete('checked')
          internals.setFormValue('off')
        }
      },
      disabled(val) {
        if (val) {
          internals.states.add('disabled')
        } else {
          internals.states.delete('disabled')
        }
      },
      valueChange(val) {
        const isChecked = internals.states.has('checked')
        if (val && isChecked) {
          internals.setFormValue('on', val)
        } else if (isChecked) {
          internals.setFormValue('on', 'checked')
        }
      },
      onAttributeChanged({ name, newValue }) {
        name === 'checked' && trigger({ type: 'checked', detail: isTypeOf<string>(newValue, 'string') })
        name === 'disabled' && trigger({ type: 'disabled', detail: isTypeOf<string>(newValue, 'string') })
        name === 'value' && trigger({ type: 'valueChange', detail: newValue })
      },
      onConnected() {
        if (root.host.hasAttribute('checked')) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        }
        if (root.host.hasAttribute('disabled')) {
          internals.states.add('disabled')
        }
      },
    }
  },
})
