import { css, isle, messenger, PlaitProps, render } from '$plaited'
export const { connect, send } = messenger()
import { test } from '$rite'
const { classes, styles } = css`.row {
  display: flex;
  gap: 10px;
  padding: 12px;
}
::slotted(button), .button {
  height: 18px;
  width: auto;
}`
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
              header.insertAdjacentHTML('beforeend', `${detail.value}`)
            },
          })
        }
      },
  )
  DynamicOne()
  DynamicTwo()

  render(
    wrapper,
    <>
      <DynamicOne.template styles={styles} id='one'>
        <div className={classes.row}>
          <button
            data-target='button'
            className={classes.button}
            data-trigger='click->click'
          >
            Add "world!"
          </button>
        </div>
      </DynamicOne.template>
      <DynamicTwo.template styles={styles}>
        <h1 data-target='header'>Hello</h1>
      </DynamicTwo.template>
    </>,
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
