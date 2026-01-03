import { bElement, joinStyles } from 'plaited'
import { isTypeOf } from 'plaited/utils'

import { hostStyles, styles } from './form-associated.css.ts'

export const ToggleInput = bElement<{
  click: MouseEvent & { target: HTMLInputElement }
  checked: boolean
  disabled: boolean
  valueChange: string | null
}>({
  tag: 'toggle-input',
  observedAttributes: ['disabled', 'checked', 'value'],
  formAssociated: true,
  shadowDom: (
    <div
      p-target='symbol'
      {...joinStyles(styles.symbol, hostStyles)}
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
        name === 'checked' &&
          trigger({
            type: 'checked',
            detail: isTypeOf<string>(newValue, 'string'),
          })
        name === 'disabled' &&
          trigger({
            type: 'disabled',
            detail: isTypeOf<string>(newValue, 'string'),
          })
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
