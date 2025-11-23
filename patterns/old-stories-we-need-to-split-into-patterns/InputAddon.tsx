import {
  bElement,
  createHostStyles,
  createStyles,
  joinStyles,
  type ObservedAttributesDetail,
  useAttributesObserver,
} from 'plaited'
import { isTypeOf, keyMirror } from 'plaited/utils'

const componentStyles = createStyles({
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

const componentHostStyles = createHostStyles({
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
        {...joinStyles(componentHostStyles, componentStyles.addOn)}
      ></slot>
      <slot
        name='input'
        p-target='slot'
        p-trigger={keyMirror('mouseenter', 'mouseleave', 'focusin', 'focusout')}
        {...componentStyles.input}
      ></slot>
      <slot
        name='suffix'
        {...componentStyles.addOn}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let [slot] = $<HTMLSlotElement>('slot')
    let input = slot?.assignedElements()[0]
    let inputObserver = useAttributesObserver('updateDisable', trigger)
    return {
      slotchange() {
        ;[slot] = $<HTMLSlotElement>('slot')
        input = slot?.assignedElements()[0]
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
        input?.hasAttribute('disabled') && internals.states.add('disabled')
        input && inputObserver(input, ['disabled'])
      },
    }
  },
})
