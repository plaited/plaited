import { test } from '$rite'
import { css, html, isle, PlaitProps, render } from '$plaited'
const { classes, styles } = css`.row {
  display: flex;
  gap: 10px;
  padding: 12px;
}
::slotted(button), .button {
  height: 18px;
  width: auto;
}`

let slot = 0
let nested = 0
let named = 0
const SlotTest = isle(
  { tag: 'slot-test' },
  (base) =>
    class extends base {
      plait({ feedback }: PlaitProps) {
        feedback({
          slot() {
            slot++
          },
          named() {
            named++
          },
          nested() {
            nested++
          },
        })
      }
    },
)
SlotTest()
const root = document.getElementById('root') as HTMLDivElement
render(
  root,
  SlotTest.template({
    styles,
    shadow: html`<div class="${classes.row}">
        <slot data-trigger="click->slot"></slot>
        <slot name="named" data-trigger="click->named" ></slot>
        <template>
          <div data-target="target">template target</div>
        </template>
        <nested-slot>
          <slot slot="nested" name="nested" data-trigger="click->nested"></slot>
        </nested-slot>
      </div>`,
    light: html`
        <button>Slot</button>
        <button slot="named">Named</button>
        <button slot="nested">Nested</button>
      `,
  }),
  'beforeend',
)
test('slot: default', async (t) => {
  const button = await t.findByText('Slot')
  button && await t.fireEvent(button, 'click')
  t({
    given: `default slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: slot,
    expected: 0,
  })
})

test('slot: named', async (t) => {
  const button = await t.findByText('Named')
  button && await t.fireEvent(button, 'click')
  t({
    given: `named slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: named,
    expected: 1,
  })
})

test('slot: nested', async (t) => {
  const button = await t.findByText('Nested')
  button && await t.fireEvent(button, 'click')
  t({
    given: `nested slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: nested,
    expected: 0,
  })
})
