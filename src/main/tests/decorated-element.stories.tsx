import {
  bElement,
  useAttributesObserver,
  type ObservedAttributesDetail,
  type FT,
  type ElementAttributeList,
} from 'plaited'
import { createStyles, createHostStyles, joinStyles } from 'plaited'
import { isTypeOf } from 'plaited/utils'
import { story } from 'plaited/testing'

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

const DecorateCheckbox = bElement<{
  change: ObservedAttributesDetail
  slotchange: void
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

const DecoratedCheckbox: FT<ElementAttributeList['input']> = (props) => {
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

export const example = story<typeof DecoratedCheckbox>({
  description: `
    DecoratedCheckbox template uses a plaited template
    to decorate an input element
    of the type checkbox.
  `,
  template: DecoratedCheckbox,
  async play({ findByAttribute, assert }) {
    const input = document.querySelector('input')
    let symbol = await findByAttribute('p-target', 'symbol')
    let backgroundColor = getComputedStyle(symbol as Element).backgroundColor
    assert({
      given: 'render of decorated checkbox',
      should: 'have light blue background',
      expected: 'rgb(173, 216, 230)',
      actual: backgroundColor,
    })
    input?.toggleAttribute('checked')
    symbol = await findByAttribute('p-target', 'symbol')
    backgroundColor = getComputedStyle(symbol as Element).backgroundColor
    assert({
      given: 'toggling slotted input checked attributed',
      should: 'have blue background',
      expected: 'rgb(0, 0, 255)',
      actual: backgroundColor,
    })
  },
})

export const checked = story<typeof DecoratedCheckbox>({
  description: `renders decorated checkbox checked`,
  template: DecoratedCheckbox,
  args: {
    checked: true,
  },
})

export const disabled = story<typeof DecoratedCheckbox>({
  description: `renders decorated checkbox disabled`,
  template: DecoratedCheckbox,
  args: {
    disabled: true,
  },
})

export const disabledAndChecked = story<typeof DecoratedCheckbox>({
  description: `renders decorated checkbox disabled and checked`,
  template: DecoratedCheckbox,
  args: {
    disabled: true,
    checked: true,
  },
})
