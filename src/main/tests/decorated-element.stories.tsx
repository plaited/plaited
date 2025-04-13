import { type StoryObj, type Args } from 'plaited/testing'
import { DecoratedCheckbox } from './decorated-element.js'

export const example: StoryObj<Args<typeof DecoratedCheckbox>> = {
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
}

export const checked: StoryObj = {
  description: `renders decorated checkbox checked`,
  template: DecoratedCheckbox,
  args: {
    checked: true,
  },
}

export const disabled: StoryObj = {
  description: `renders decorated checkbox disabled`,
  template: DecoratedCheckbox,
  args: {
    disabled: true,
  },
}

export const disabledAndChecked: StoryObj = {
  description: `renders decorated checkbox disabled and checked`,
  template: DecoratedCheckbox,
  args: {
    disabled: true,
    checked: true,
  },
}
