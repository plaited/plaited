import { bElement, useAttributesObserver, type ObservedAttributesDetail } from 'plaited'
import { isTypeOf, keyMirror } from 'plaited/utils'
import { css } from 'plaited'

const styles = css.create({
  addOn: {
    flex: {
      '::slotted(*)': 'none',
    },
  },
  input: {
    flex: {
      '::slotted([slot=input])': '1',
    },
  },
})

const hostStyles = css.host({
  display: 'inline-flex',
  '--icon-stroke': {
    $default: 'lightblue',
    $compoundSelectors: {
      ':state(focused)': 'blue',
      ':state(disabled)': 'grey',
    },
  },
})

export const InputAddon = bElement<{
  updateDisable: ObservedAttributesDetail
  slotchange: undefined
}>({
  tag: 'input-addon',
  shadowDom: (
    <>
      <slot
        name='prefix'
        {...css.join(hostStyles, styles.addOn)}
      ></slot>
      <slot
        name='input'
        p-target='slot'
        p-trigger={keyMirror('mouseenter', 'mouseleave', 'focusin', 'focusout')}
        {...styles.input}
      ></slot>
      <slot
        name='suffix'
        {...styles.addOn}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let [slot] = $<HTMLSlotElement>('slot')
    let [input] = slot.assignedElements()
    let inputObserver = useAttributesObserver('updateDisable', trigger)
    return {
      slotchange() {
        ;[slot] = $<HTMLSlotElement>('slot')
        ;[input] = slot.assignedElements()
        inputObserver = useAttributesObserver('updateDisable', trigger)
      },
      updateDisable({ name, newValue }) {
        isTypeOf<string>(newValue, 'string') ? internals.states.add(name) : internals.states.delete(name)
      },
      focusin() {
        console.log('focusin')
        internals.states.add('focused')
      },
      focusout() {
        console.log('focusout')
        internals.states.delete('focused')
      },
      mouseenter() {
        console.log('mouseenter')
      },
      mouseleave() {
        console.log('mouseleave')
      },
      onConnected() {
        input.hasAttribute('disabled') && internals.states.add('disabled')
        inputObserver(input, ['disabled'])
      },
    }
  },
})
