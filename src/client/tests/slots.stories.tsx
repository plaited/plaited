import type { StoryObj } from '../../workshop/workshop.types.js'
import { Fixture, defaultSlot, passThroughSlot, namedSlot, nestedSlot, nestedInShadowSlot } from './slots.js'

export const slots: StoryObj = {
  template: Fixture,
  play: async ({ assert, findByText, fireEvent }) => {
    let button = await findByText('Slot')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `button in default slot`,
      should: 'trigger Outer feedback action',
      actual: defaultSlot.called,
      expected: true,
    })
    button = await findByText('Named')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `button in named slot`,
      should: 'trigger Outer feedback action',
      actual: namedSlot.called,
      expected: true,
    })
    button = await findByText('Nested')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `click nested & slotted button in Outer light dom`,
      should: 'not trigger Outer feedback action',
      actual: passThroughSlot.called,
      expected: false,
    })
    assert({
      given: `click nested & slotted button in Outer light dom`,
      should: 'trigger Outer feedback action',
      actual: nestedSlot.called,
      expected: true,
    })
    button = await findByText('Shadow')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `click slotted button in Outer shadow dom`,
      should: 'not trigger Outer feedback action',
      actual: passThroughSlot.called,
      expected: false,
    })
    assert({
      given: `click slotted button in Outer shadow dom`,
      should: 'trigger Inner feedback action',
      actual: nestedInShadowSlot.called,
      expected: true,
    })
  },
}
