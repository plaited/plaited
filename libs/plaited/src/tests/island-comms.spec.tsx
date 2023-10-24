import { css } from '@plaited/jsx'
import { test } from '@plaited/rite'
import { isle, PlaitProps, useMessenger } from '../index.js'

test('dynamic island comms', async t => {
  const [ connect, send ] = useMessenger()
  const [ classes, stylesheet ] = css`.row {
  display: flex;
  gap: 10px;
  padding: 12px;
}
.button {
  height: 18px;
  width: auto;
}`
  const wrapper = document.querySelector('body')
  const elOne = isle(
    {
      tag: 'dynamic-one',
      id: true,
      connect,
    },
    base =>
      class extends base {
        static template = <div className={classes.row}
          {...stylesheet}
        >
          <button
            data-target='button'
            className={classes.button}
            data-trigger={{ click: 'click' }}
          >
          Add "world!"
          </button>
        </div>
        plait({ feedback, $ }: PlaitProps) {
          feedback({
            disable() {
              const button = $<HTMLButtonElement>('button')
              button && (button.disabled = true)
            },
            click() {
              send('dynamic-two', {
                type: 'add',
                detail: { value: ' World!' },
              })
            },
          })
        }
      }
  )
  const elTwo = isle(
    {
      tag: 'dynamic-two',
      connect,
    },
    base =>
      class extends base {
        static template = <h1 data-target='header'
          {...stylesheet}
        >Hello</h1>
        plait({ $, feedback, addThreads, thread, sync }: PlaitProps) {
          addThreads({
            onAdd: thread(
              sync({ waitFor: { type: 'add' } }),
              sync({ request: { type: 'disable' } })
            ),
          })
          feedback({
            disable() {
              send('one', { type: 'disable' })
            },
            add(detail: { value: string }) {
              const header = $('header')
              header?.insertAdjacentHTML('beforeend', `${detail.value}`)
            },
          })
        }
      }
  )
  // Define elements
  elOne()
  elTwo()
  // Create elements and append to dom
  const one = document.createElement(elOne.tag)
  one.id = 'one'
  const two = document.createElement(elTwo.tag)
  wrapper.insertAdjacentElement('beforeend', one)
  wrapper.insertAdjacentElement('beforeend', two)

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
    wrapper
  )
  t({
    given: 'clicking button',
    should: 'be disabled',
    actual: (button as HTMLButtonElement)?.disabled,
    expected: true,
  })
})
