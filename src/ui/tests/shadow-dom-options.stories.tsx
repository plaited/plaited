import { story } from 'plaited/testing'
import type { BehavioralElement } from 'plaited/ui'

import { ClosedShadow, NoFocusDelegation, OpenShadow } from './fixtures/shadow-dom-options.tsx'

export const defaultModeAndFocus = story({
  description: `This test is used to validate a Behavioral element created using bElement
  default to having it's mode open`,
  template: () => <OpenShadow p-target='el' />,
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
})

export const delegatesFocusFalse = story({
  description: `This test is used to validate a Behavioral element created using bElement
  with the parameter delefateFocus set to false does not allow focus delegation.`,
  template: () => <NoFocusDelegation p-target='el' />,
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
})

export const closedMode = story({
  description: `This test is used to validate a Behavioral element created using bElement
  with the parameter mode set to false create a custom element with a closed shadow dom.`,
  template: () => <ClosedShadow p-target='el' />,
  play: async ({ assert, findByAttribute }) => {
    const host = await findByAttribute<BehavioralElement>('p-target', 'el')
    assert({
      given: 'setHTMLUnsafe',
      should: 'return null',
      actual: host?.shadowRoot,
      expected: null,
    })
  },
})
