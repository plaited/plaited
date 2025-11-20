import { bElement, type FT } from 'plaited'
import { story } from 'plaited/testing'
import sinon from 'sinon'

const defaultSlot = sinon.spy()
const passThroughSlot = sinon.spy()
const namedSlot = sinon.spy()
const nestedSlot = sinon.spy()
const nestedInShadowSlot = sinon.spy()

const Inner = bElement({
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
  bProgram() {
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

const Outer = bElement({
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
        <button
          type='button'
          slot='shadow'
        >
          Shadow
        </button>
      </Inner>
    </div>
  ),
  bProgram: () => ({
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

const Fixture: FT = () => (
  <Outer>
    <button type='button'>Slot</button>
    <button
      type='button'
      slot='named'
    >
      Named
    </button>
    <button
      type='button'
      slot='nested'
    >
      Nested
    </button>
  </Outer>
)

export const slots = story<typeof Fixture>({
  description: `This story is used to validate that p-trigger attribute on slot elements in a
  Behavioral elements shadow DOM only allow event triggering on named and default slots in
  it's shadow dom but not on pass through slots.`,
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
})
