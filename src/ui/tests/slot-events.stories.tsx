import { story } from 'plaited/testing'
import sinon from 'sinon'

import { createNestedSlotHost, createSlotContainer, createSlotEventsFixture } from './fixtures/slot-events.tsx'

const defaultSlot = sinon.spy()
const passThroughSlot = sinon.spy()
const namedSlot = sinon.spy()
const nestedSlot = sinon.spy()
const nestedInShadowSlot = sinon.spy()

const NestedSlotHost = createNestedSlotHost(() => ({
  nested(e: Event) {
    e.stopPropagation()
    nestedSlot()
  },
  nestedInShadow(e: Event) {
    e.stopPropagation()
    nestedInShadowSlot()
  },
}))

const SlotContainer = createSlotContainer(NestedSlotHost, () => ({
  slot() {
    defaultSlot()
  },
  named() {
    namedSlot()
  },
  passThrough() {
    passThroughSlot()
  },
}))

const SlotEventsFixture = createSlotEventsFixture(SlotContainer)

export const slotEventDelegation = story<typeof SlotEventsFixture>({
  intent: `This story is used to validate that p-trigger attribute on slot elements in a
  Behavioral elements shadow DOM only allow event triggering on named and default slots in
  it's shadow dom but not on pass through slots.`,
  template: SlotEventsFixture,
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
})
