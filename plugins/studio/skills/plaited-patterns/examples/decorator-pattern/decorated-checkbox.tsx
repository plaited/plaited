import { bElement, useAttributesObserver } from 'plaited'
import { hostStyles, styles } from './decorated-checkbox.css.ts'

/**
 * DecorateCheckbox - Wraps native checkbox with custom styling
 *
 * Demonstrates decorator pattern for hard-to-style native elements.
 * Uses useAttributesObserver to sync slotted checkbox state with custom states.
 */
export const DecorateCheckbox = bElement({
  tag: 'decorate-checkbox',
  hostStyles,
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
        {...styles.input}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let slot = $<HTMLSlotElement>('slot')[0]
    let input = slot?.assignedElements()[0]
    let inputObserver = useAttributesObserver('change', trigger)

    return {
      slotchange() {
        // Re-query after slot content changes
        slot = $<HTMLSlotElement>('slot')[0]
        input = slot?.assignedElements()[0]
        inputObserver = useAttributesObserver('change', trigger)
      },

      change({ name, newValue }) {
        // Sync slotted input attributes with custom states
        newValue ? internals.states.add(name) : internals.states.delete(name)
      },

      onConnected() {
        // Initialize states from slotted input
        input?.hasAttribute('checked') && internals.states.add('checked')
        input?.hasAttribute('disabled') && internals.states.add('disabled')

        // Start observing slotted input attributes
        input && inputObserver(input, ['checked', 'disabled'])
      },
    }
  },
})
