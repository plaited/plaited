import { test } from '@plaited/rite'
import { PlaitProps } from '@plaited/component-types'
import { Component } from '../index.js'
import sinon from 'sinon'

const defaultSlot = sinon.spy()
const passThroughSlot = sinon.spy()
const namedSlot = sinon.spy()
const nestedSlot = sinon.spy()

class Nested extends Component({
  tag: 'nested-slot',
  template: <slot data-trigger={{ click: 'nested' }}></slot>,
}) {
  plait(props: PlaitProps): void | Promise<void> {
    props.feedback({
      nested() {
        nestedSlot('nested-slot')
      },
    })
  }
}

class Fixture extends Component({
  tag: 'slot-test',
  template: (
    <div>
      <slot data-trigger={{ click: 'slot' }}></slot>
      <slot
        name='named'
        data-trigger={{ click: 'named' }}
      ></slot>
      <Nested>
        <slot
          name='nested'
          data-trigger={{ click: 'nested' }}
        ></slot>
      </Nested>
    </div>
  ),
}) {
  plait({ feedback }: PlaitProps) {
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
  }
}

//define our fixture
customElements.define(Fixture.tag, Fixture)
// We need to define our nest-slot Component
customElements.define(Nested.tag, Nested)
const root = document.querySelector('body')

root.insertAdjacentHTML(
  'beforeend',
  `<${Fixture.tag}>
    <button>Slot</button>
    <button slot='named'>Named</button>
    <button slot='nested'>Nested</button>
  </${Fixture.tag}>`,
)

test('slot: default', async (t) => {
  const button = await t.findByText('Slot')
  button && (await t.fireEvent(button, 'click'))
  t({
    given: `default slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: defaultSlot.calledWith('default-slot'),
    expected: true,
  })
})

test('slot: named', async (t) => {
  const button = await t.findByText('Named')
  button && (await t.fireEvent(button, 'click'))
  t({
    given: `named slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: namedSlot.calledWith('named-slot'),
    expected: true,
  })
})

test('slot: passThrough', async (t) => {
  const button = await t.findByText('Nested')
  button && (await t.fireEvent(button, 'click'))
  t({
    given: `nested slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: passThroughSlot.calledWith('pass-through-slot'),
    expected: false,
  })
})

test('slot: nested', async (t) => {
  const button = await t.findByText('Nested')
  button && (await t.fireEvent(button, 'click'))
  t({
    given: `nested slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: nestedSlot.calledWith('nested-slot'),
    expected: true,
  })
})
