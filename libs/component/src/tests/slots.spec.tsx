import { test } from '@plaited/rite'
import { css } from '@plaited/jsx'
import { Component, PlaitProps } from '../index.js'
import sinon from 'sinon'
const [classes, stylesheet] = css`
  .row {
    display: flex;
    gap: 12px;
    padding: 12px;
  }
  ::slotted(button),
  .button {
    height: 18px;
    width: auto;
  }
`
const slot = sinon.spy()
const nested = sinon.spy()
const named = sinon.spy()

class Fixture extends Component({
  tag: 'slot-test',
  template: (
    <div
      className={classes.row}
      {...stylesheet}
    >
      <slot data-trigger={{ click: 'slot' }}></slot>
      <slot
        name='named'
        data-trigger={{ click: 'named' }}
      ></slot>
      <nested-slot
        slots={
          <slot
            slot='nested'
            name='nested'
            data-trigger={{ click: 'nested' }}
          ></slot>
        }
      >
        <slot name='nested'></slot>
      </nested-slot>
    </div>
  ),
}) {
  plait({ feedback }: PlaitProps) {
    feedback({
      slot() {
        slot('slot')
      },
      named() {
        named('named')
      },
      nested() {
        nested('nested')
      },
    })
  }
}

//define our fixture
customElements.define(Fixture.tag, Fixture)
// We need to define our nest-slot Component

const root = document.querySelector('body')

root.insertAdjacentHTML(
  'beforeend',
  `<${Fixture.tag}>
    <button class="${classes.button}">Slot</button>
    <button slot='named'
      class="${classes.button}"
    >Named</button>
    <button slot='nested'
      class="${classes.button}"
    >Nested</button>
  </${Fixture.tag}>`,
)

test('slot: default', async (t) => {
  const button = await t.findByText('Slot')
  button && (await t.fireEvent(button, 'click'))
  t({
    given: `default slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: slot.called,
    expected: true,
  })
})

test('slot: named', async (t) => {
  const button = await t.findByText('Named')
  button && (await t.fireEvent(button, 'click'))
  t({
    given: `named slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: named.calledWith('named'),
    expected: true,
  })
})

test('slot: nested', async (t) => {
  const button = await t.findByText('Nested')
  button && (await t.fireEvent(button, 'click'))
  t({
    given: `nested slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: nested.called,
    expected: false,
  })
})
