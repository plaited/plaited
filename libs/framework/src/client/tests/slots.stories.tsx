import { assert, findByText, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { defineTemplate } from '../define-template.js'
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

const Nested = defineTemplate({
  tag: 'nested-slot',
  shadowDom: <slot p-trigger={{ click: 'nested' }}></slot>,
  connectedCallback() {
    return {
      nested() {
        nestedSlot()
      },
    }
  },
})

const Fixture = defineTemplate({
  tag: 'slot-test',
  shadowDom: (
    <div>
      <slot p-trigger={{ click: 'slot' }}></slot>
      <slot
        name='named'
        p-trigger={{ click: 'named' }}
      ></slot>
      <Nested>
        <slot
          name='nested'
          p-trigger={{ click: 'nested' }}
        ></slot>
      </Nested>
    </div>
  ),
  connectedCallback: () => ({
    slot() {
      defaultSlot()
    },
    named() {
      namedSlot()
    },
    nested() {
      passThroughSlot()
    },
  }),
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
      actual: defaultSlot.called,
      expected: true,
    })
    button = await findByText('Named')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `named slot click of element in event's composed path`,
      should: 'trigger feedback action',
      actual: namedSlot.called,
      expected: true,
    })
    button = await findByText('Nested')
    button && (await fireEvent(button, 'click'))
    assert({
      given: `nested slot click of element in event's composed path`,
      should: 'not trigger feedback action',
      actual: passThroughSlot.called,
      expected: false,
    })
    assert({
      given: `nested slot click of element in event's composed path`,
      should: 'not trigger feedback action',
      actual: nestedSlot.called,
      expected: true,
    })
  },
}
