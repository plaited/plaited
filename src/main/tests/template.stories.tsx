import { type BehavioralElement, bElement } from 'plaited'
import type { StoryObj } from 'plaited/testing'

const DelegateFalse = bElement({
  tag: 'delegate-false',
  delegatesFocus: false,
  shadowDom: <span>mode open and delegates focus</span>,
})

const ModeOpen = bElement({
  tag: 'mode-open',
  shadowDom: <span>mode open and delegates focus</span>,
})

const ClosedMode = bElement({
  tag: 'mode-closed',
  mode: 'closed',
  shadowDom: <span>mode open and delegates focus</span>,
})

export const defaultModeAndFocus: StoryObj = {
  description: `This test is used to validate a Behavioral element created using bElement
  default to having it's mode open`,
  template: () => <ModeOpen p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<BehavioralElement>('p-target', 'el')
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
  description: `This test is used to validate a Behavioral element created using bElement
  with the parameter delefateFocus set to false does not allow focus delegation.`,
  template: () => <DelegateFalse p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<BehavioralElement>('p-target', 'el')
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
  description: `This test is used to validate a Behavioral element created using bElement
  with the parameter mode set to false create a custom element with a closed shadow dom.`,
  template: () => <ClosedMode p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<BehavioralElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'return null',
      actual: host?.shadowRoot,
      expected: null,
    })
  },
}
