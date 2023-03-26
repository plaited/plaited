import { html, isle, messenger, PlaitProps, render } from '$plaited'
import { classes, styles } from '../test.styles.ts'
export const { connect, send } = messenger()
import { test } from '../test.ts'

test('dynamic island comms', async (t) => {
  const wrapper = document.querySelector('#root') as HTMLDivElement
  const DynamicOne = isle(
    {
      tag: 'dynamic-one',
      id: true,
      connect,
    },
    (base) =>
      class extends base {
        plait({ feedback, $ }: PlaitProps) {
          feedback({
            disable() {
              const [button] = $<HTMLButtonElement>('button')
              button.disabled = true
            },
            click() {
              send('dynamic-two', { type: 'add', detail: { value: ' World!' } })
            },
          })
        }
      },
  )
  const DynamicTwo = isle(
    {
      tag: 'dynamic-two',
      connect,
    },
    (base) =>
      class extends base {
        plait({ $, feedback, addThreads, thread, sync }: PlaitProps) {
          addThreads({
            onAdd: thread(
              sync({ waitFor: { type: 'add' } }),
              sync({ request: { type: 'disable' } }),
            ),
          })
          feedback({
            disable() {
              send('one', { type: 'disable' })
            },
            add(detail: { value: string }) {
              const [header] = $('header')
              render(header, `${detail.value}`, 'beforeend')
            },
          })
        }
      },
  )
  DynamicOne()
  DynamicTwo()

  render(
    wrapper,
    html`${[
      DynamicOne.template({
        styles,
        id: 'one',
        shadow:
          html`<div class="${classes.row}"><button data-target="button" class="${classes.button}" data-trigger="click->click">Add "world!"</button></div>`,
      }),
      DynamicTwo.template({
        styles,
        shadow: html`<h1 data-target="header">Hello </h1>`,
      }),
    ]}`,
    'beforeend',
  )
  let button = await t.findByAttribute('data-target', 'button', wrapper)
  const header = await t.findByAttribute('data-target', 'header', wrapper)
  t({
    given: 'render',
    should: 'header should contain string',
    actual: header?.innerHTML,
    expected: 'Hello',
  })
  button && await t.fireEvent(button, 'click')
  t({
    given: 'clicking button',
    should: 'append string to header',
    actual: header?.innerHTML,
    expected: 'Hello World!',
  })
  button = await t.findByAttribute(
    'data-target',
    'button',
    wrapper,
  )
  t({
    given: 'clicking button',
    should: 'be disabled',
    actual: (button as HTMLButtonElement)?.disabled,
    expected: true,
  })
})
