import { type StoryObj, type Args } from 'plaited/testing'
import { DecoratedCheckbox } from './DecoratedCheckbox.js'

export const example: StoryObj<Args<typeof DecoratedCheckbox>> = {
  template: DecoratedCheckbox,
  description: `
    DecoratedCheckbox template uses a plaited template
    to decorate an input element
    of the type checkbox.
  `,
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
}

export const checked: StoryObj = {
  template: DecoratedCheckbox,
  description: `DecoratedCheckbox rendered with the checked prop set to true.`,
  args: {
    checked: true,
  },
}

export const disabled: StoryObj = {
  template: DecoratedCheckbox,
  description: `DecoratedCheckbox rendered with the disabled prop set to true.`,
  args: {
    disabled: true,
  },
}

export const disabledAndChecked: StoryObj = {
  template: DecoratedCheckbox,
  description: `DecoratedCheckbox rendered with the disabled and checked props set to true.`,
  args: {
    disabled: true,
    checked: true,
  },
}
