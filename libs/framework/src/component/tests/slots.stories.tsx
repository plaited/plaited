import { assert, findByText, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { Component } from '../component.js'
import sinon from 'sinon'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

const defaultSlot = sinon.spy()
const passThroughSlot = sinon.spy()
const namedSlot = sinon.spy()
const nestedSlot = sinon.spy()

const Nested = Component({
  tag: 'nested-slot',
  template: <slot bp-trigger={{ click: 'nested' }}></slot>,
  bp(props): void | Promise<void> {
    props.feedback({
      nested() {
        nestedSlot('nested-slot')
      },
    })
  },
})

const Fixture = Component({
  tag: 'slot-test',
  template: (
    <div>
      <slot bp-trigger={{ click: 'slot' }}></slot>
      <slot
        name='named'
        bp-trigger={{ click: 'named' }}
      ></slot>
      <Nested>
        <slot
          name='nested'
          bp-trigger={{ click: 'nested' }}
        ></slot>
      </Nested>
    </div>
  ),
  bp({ feedback }) {
    feedback({
      slot() {
        defaultSlot('default-slot')
      },
      named() {
        namedSlot('named-slot')
      },
      nested() {
        passThroughSlot('pass-through-slot')
      },
    })
  },
})

export const slots: StoryObj = {
  render: () => (
    <Fixture>
      <button>Slot</button>
      <button slot='named'>Named</button>
      <button slot='nested'>Nested</button>
    </Fixture>
  ),
  play: async () => {
    let button = await findByText('Slot')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `default slot click of element in event's composed path`,
      should: 'trigger feedback action',
      actual: defaultSlot.calledWith('default-slot'),
      expected: true,
    })
    button = await findByText('Named')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `named slot click of element in event's composed path`,
      should: 'trigger feedback action',
      actual: namedSlot.calledWith('named-slot'),
      expected: true,
    })
    button = await findByText('Nested')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `nested slot click of element in event's composed path`,
      should: 'not trigger feedback action',
      actual: passThroughSlot.calledWith('pass-through-slot'),
      expected: false,
    })
    button = await findByText('Nested')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `nested slot click of element in event's composed path`,
      should: 'not trigger feedback action',
      actual: nestedSlot.calledWith('nested-slot'),
      expected: true,
    })
  },
}
