import { bElement, useAttributesObserver } from 'plaited/ui'
import { keyMirror } from 'plaited/utils'
import { hostStyles, styles } from './input-addon.css.ts'

/**
 * InputAddon - Decorates input with prefix/suffix slots
 *
 * Demonstrates ::slotted() styling for light DOM elements.
 * Shows how to observe attributes on slotted elements.
 */
export const InputAddon = bElement({
  tag: 'input-addon',
  hostStyles,
  shadowDom: (
    <>
      <slot
        name='prefix'
        {...styles.addOn}
      ></slot>
      <slot
        name='input'
        p-target='slot'
        p-trigger={keyMirror('mouseenter', 'mouseleave', 'focusin', 'focusout')}
        {...styles.input}
      />
      <slot
        name='suffix'
        {...styles.addOn}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let slot = $<HTMLSlotElement>('slot')[0]
    let input = slot?.assignedElements()[0]
    let inputObserver = useAttributesObserver('updateDisable', trigger)

    return {
      slotchange() {
        // Re-query when slot content changes
        slot = $<HTMLSlotElement>('slot')[0]
        input = slot?.assignedElements()[0]
        inputObserver = useAttributesObserver('updateDisable', trigger)
      },

      updateDisable({ name, newValue }) {
        // Sync slotted input disabled state with custom state
        newValue ? internals.states.add(name) : internals.states.delete(name)
      },

      focusin() {
        internals.states.add('focused')
      },

      focusout() {
        internals.states.delete('focused')
      },

      mouseenter() {
        // Can add hover state if needed
      },

      mouseleave() {
        // Can remove hover state if needed
      },

      onConnected() {
        // Initialize disabled state from slotted input
        input?.hasAttribute('disabled') && internals.states.add('disabled')
        input && inputObserver(input, ['disabled'])
      },
    }
  },
})
