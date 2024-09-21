import { StoryObj } from '../../workshop/workshop.types.js'
import { defineTemplate } from '../define-template.js'
import sinon from 'sinon'

const defaultSlot = sinon.spy()
const passThroughSlot = sinon.spy()
const namedSlot = sinon.spy()
const nestedSlot = sinon.spy()
const nestedInShadowSlot = sinon.spy()

const Inner = defineTemplate({
  tag: 'inner-slot',
  shadowDom: (
    <>
      <slot p-trigger={{ click: 'nested' }}></slot>
      <slot
        p-trigger={{ click: 'nestedInShadow' }}
        name='shadow'
      ></slot>
    </>
  ),
  connectedCallback() {
    return {
      nested(e: Event) {
        e.stopPropagation()
        nestedSlot()
      },
      nestedInShadow(e: Event) {
        e.stopPropagation()
        nestedInShadowSlot()
      },
    }
  },
})

const Outer = defineTemplate({
  tag: 'outer-slot',
  shadowDom: (
    <div>
      <slot p-trigger={{ click: 'slot' }}></slot>
      <slot
        name='named'
        p-trigger={{ click: 'named' }}
      ></slot>
      <Inner p-trigger={{ click: 'passThrough' }}>
        <slot name='nested'></slot>
        <button slot='shadow'>Shadow</button>
      </Inner>
    </div>
  ),
  connectedCallback: () => ({
    slot() {
      defaultSlot()
    },
    named() {
      namedSlot()
    },
    passThrough() {
      passThroughSlot()
    },
  }),
})

export const slots: StoryObj = {
  template: () => (
    <Outer>
      <button>Slot</button>
      <button slot='named'>Named</button>
      <button slot='nested'>Nested</button>
    </Outer>
  ),
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
