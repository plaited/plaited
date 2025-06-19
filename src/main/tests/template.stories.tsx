import type { StoryObj } from 'plaited/workshop'
import { type PlaitedElement } from 'plaited'
import { ModeOpen, DelegateFalse, ClosedMode } from './template.js'

export const defaultModeAndFocus: StoryObj = {
  description: `This test is used to validate a plaited element created using defineElement
  default to having it's mode open`,
  template: () => <ModeOpen p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<PlaitedElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.delegatesFocus,
      expected: true,
    })
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.mode,
      expected: 'open',
    })
  },
}

export const delegatesFocusFalse: StoryObj = {
  description: `This test is used to validate a plaited element created using defineElement
  with the parameter delefateFocus set to false does not allow focus delegation.`,
  template: () => <DelegateFalse p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<PlaitedElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.delegatesFocus,
      expected: false,
    })
    assert({
      given: 'setHTMLUnsafe',
      should: 'delegate focus',
      actual: host?.shadowRoot?.mode,
      expected: 'open',
    })
  },
}

export const closedMode: StoryObj = {
  description: `This test is used to validate a plaited element created using defineElement
  with the parameter mode set to false create a custom element with a closed shadow dom.`,
  template: () => <ClosedMode p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<PlaitedElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'return null',
      actual: host?.shadowRoot,
      expected: null,
    })
  },
}