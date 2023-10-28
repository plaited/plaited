import { css } from '@plaited/jsx'
import { test } from '@plaited/rite'
import { useMessenger } from '@plaited/comms'
import { component, PlaitProps } from '../index.js'

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
  class ElOne extends component({
    connect,
    tag: 'dynamic-one',
    template: <div className={classes.row}
      {...stylesheet}
    >
      <button
        data-target='button'
        className={classes.button}
        data-trigger={{ click: 'click' }}
      >
          Add "world!"
      </button>
    </div>, 
  }) {
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
  class ElTwo extends component({
    connect,
    tag: 'dynamic-two',
    template: <h1 data-target='header'
      {...stylesheet}
    >Hello</h1>,
  }) {
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
  // Define elements
  customElements.define(ElOne.tag, ElOne)
  customElements.define(ElTwo.tag, ElTwo)
  // Create elements and append to dom
  const one = document.createElement(ElOne.tag)
  one.id = 'one'
  const two = document.createElement(ElTwo.tag)
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
