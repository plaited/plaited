import {
  bElement,
  createHostStyles,
  createStyles,
  type ElementAttributeList,
  type FT,
  joinStyles,
  type ObservedAttributesDetail,
  useAttributesObserver,
} from 'plaited'
import { isTypeOf } from 'plaited/utils'

const componentStyles = createStyles({
  grid: {
    display: 'inline-grid',
    gridTemplate: '"input" 16px / 16px',
  },
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: 'var(--fill)',
    gridArea: 'input',
  },
  input: {
    gridArea: 'input',
    height: '16px',
    width: '16px',
    opacity: 0,
    margin: 0,
    padding: 0,
  },
})

const componentHostStyles = createHostStyles({
  display: 'inline-grid',
  gridTemplate: '"input" 16px / 16px',
  '--fill': {
    $default: 'lightblue',
    $compoundSelectors: {
      ':state(checked)': 'blue',
      ':state(disabled)': 'grey',
    },
  },
})

export const DecorateCheckbox = bElement<{
  change: ObservedAttributesDetail
  slotchange: undefined
}>({
  tag: 'decorate-checkbox',
  shadowDom: (
    <>
      <div
        p-target='symbol'
        {...joinStyles(componentStyles.symbol, componentHostStyles)}
        p-trigger={{ click: 'click' }}
      />
      <slot
        p-target='slot'
        p-trigger={{ slotchange: 'slotchange' }}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let [slot] = $<HTMLSlotElement>('slot')
    let [input] = slot.assignedElements()
    let inputObserver = useAttributesObserver('change', trigger)
    return {
      slotchange() {
        ;[slot] = $<HTMLSlotElement>('slot')
        ;[input] = slot.assignedElements()
        inputObserver = useAttributesObserver('change', trigger)
      },
      change({ name, newValue }) {
        isTypeOf<string>(newValue, 'string') ? internals.states.add(name) : internals.states.delete(name)
      },
      onConnected() {
        input.hasAttribute('checked') && internals.states.add('checked')
        input.hasAttribute('disabled') && internals.states.add('disabled')
        inputObserver(input, ['checked', 'disabled'])
      },
    }
  },
})

export const DecoratedCheckbox: FT<ElementAttributeList['input']> = (props) => {
  return (
    <DecorateCheckbox>
      <input
        {...props}
        {...componentStyles.input}
        type='checkbox'
      />
    </DecorateCheckbox>
  )
}
