import { bElement, type ObservedAttributesDetail, useAttributesObserver } from 'plaited/ui'
import { isTypeOf } from 'plaited/utils'

import { hostStyles, styles } from './decorator-pattern.css.ts'

export const DecorateCheckbox = bElement<{
  change: ObservedAttributesDetail
  slotchange: undefined
}>({
  tag: 'decorate-checkbox',
  hostStyles: hostStyles,
  shadowDom: (
    <>
      <div
        p-target='symbol'
        {...styles.symbol}
        p-trigger={{ click: 'click' }}
      />
      <slot
        p-target='slot'
        p-trigger={{ slotchange: 'slotchange' }}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let slot = $<HTMLSlotElement>('slot')[0]
    let input = slot?.assignedElements()[0]
    let inputObserver = useAttributesObserver('change', trigger)
    return {
      slotchange() {
        slot = $<HTMLSlotElement>('slot')[0]
        input = slot?.assignedElements()[0]
        inputObserver = useAttributesObserver('change', trigger)
      },
      change({ name, newValue }) {
        isTypeOf<string>(newValue, 'string') ? internals.states.add(name) : internals.states.delete(name)
      },
      onConnected() {
        input?.hasAttribute('checked') && internals.states.add('checked')
        input?.hasAttribute('disabled') && internals.states.add('disabled')
        input && inputObserver(input, ['checked', 'disabled'])
      },
    }
  },
})
