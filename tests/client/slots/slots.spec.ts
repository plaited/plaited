import { test } from '../test.ts'
import { html, isle, PlaitProps, render } from '$plaited'
import { classes, styles } from '../test.styles.ts'
test('slot test', async (t) => {
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
  let button = await t.findByText('Slot')
  button && await t.fireEvent(button, 'click')
  button = await t.findByText('Named')
  button && await t.fireEvent(button, 'click')
  button = await t.findByText('Nested')
  button && await t.fireEvent(button, 'click')
  t({
    given: `default slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: slot,
    expected: 0,
  })
  t({
    given: `named slot click of element in event's composed path`,
    should: 'trigger feedback action',
    actual: named,
    expected: 1,
  })
  t({
    given: `nested slot click of element in event's composed path`,
    should: 'not trigger feedback action',
    actual: nested,
    expected: 0,
  })
})
