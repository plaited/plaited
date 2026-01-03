import { story } from 'plaited/testing'
import type { ElementAttributeList, FT } from 'plaited/ui'

import { styles } from './fixtures/decorator-pattern.css.ts'
import { DecorateCheckbox } from './fixtures/decorator-pattern.tsx'

const DecoratedCheckbox: FT<ElementAttributeList['input']> = (props) => {
  return (
    <DecorateCheckbox>
      <input
        {...props}
        {...styles.input}
        type='checkbox'
      />
    </DecorateCheckbox>
  )
}

export const uncheckedState = story<typeof DecoratedCheckbox>({
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
