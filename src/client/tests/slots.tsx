import { FT } from 'src/jsx/jsx.types.js'
import { defineTemplate } from '../define-template.js'
import sinon from 'sinon'

export const defaultSlot = sinon.spy()
export const passThroughSlot = sinon.spy()
export const namedSlot = sinon.spy()
export const nestedSlot = sinon.spy()
export const nestedInShadowSlot = sinon.spy()

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

export const Fixture: FT = () => (
  <Outer>
    <button>Slot</button>
    <button slot='named'>Named</button>
    <button slot='nested'>Nested</button>
  </Outer>
)
