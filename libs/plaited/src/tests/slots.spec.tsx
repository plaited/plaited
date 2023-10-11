import { test } from '@plaited/rite'
import {  css, PlaitedElement } from '@plaited/jsx'
import { isle, PlaitProps, useSugar } from '../index.js'
import sinon from 'sinon'
const [ classes, stylesheet ] = css`.row {
  display: flex;
  gap: 12px;
  padding: 12px;
}
::slotted(button), .button {
  height: 18px;
  width: auto;
}`
const slot = sinon.spy()
const nested = sinon.spy()
const named = sinon.spy()
const SlotTest = isle(
  { tag: 'slot-test' },
  base =>
    class extends base {
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
)
SlotTest()
isle({ tag:'nested-slot' })()
const root = document.querySelector('body')
const SlotTestTemplate: PlaitedElement = ({ children }) => (
  <SlotTest.template {...stylesheet}
    slots={children}
  >
    <div className={classes.row}>
      <slot data-trigger={{ click: 'slot' }}></slot>
      <slot name='named'
        data-trigger={{ click: 'named' }}
      ></slot>
      <template>
        <div data-target='target'>template target</div>
      </template>
      <nested-slot slots={<slot slot='nested'
        name='nested'
        data-trigger={{ click: 'nested' }}
      >
      </slot>}
      >
        <slot name='nested'></slot>
      </nested-slot>
    </div>
  </SlotTest.template>
)
useSugar(root).render(
  <SlotTestTemplate>
    <button className={classes.button}>Slot</button>
    <button slot='named'
      className={classes.button}
    >Named</button>
    <button slot='nested'
      className={classes.button}
    >Nested</button>
  </SlotTestTemplate>,
  'beforeend'
)

test('slot: default', async t => {
  const button = await t.findByText('Slot')
  button && await t.fireEvent(button, 'click')
  t({
    given: `default slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: slot.called,
    expected: true,
  })
})

test('slot: named', async t => {
  const button = await t.findByText('Named')
  button && await t.fireEvent(button, 'click')
  t({
    given: `named slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: named.calledWith('named'),
    expected: true,
  })
})

test('slot: nested', async t => {
  const button = await t.findByText('Nested')
  button && await t.fireEvent(button, 'click')
  t({
    given: `nested slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: nested.called,
    expected: false,
  })
})
