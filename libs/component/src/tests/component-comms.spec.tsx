import { css } from '@plaited/jsx'
import { dataAddress } from '@plaited/jsx/utils'
import { test } from '@plaited/rite'
import { Component, PlaitProps } from '../index.js'
import { messenger } from '../utils.js'

test('dynamic island comms', async (t) => {
  const msg = messenger()
  const [classes, stylesheet] = css`
    .row {
      display: flex;
      gap: 10px;
      padding: 12px;
    }
    .button {
      height: 18px;
      width: auto;
    }
  `
  const wrapper = document.querySelector('body')
  class ElOne extends Component({
    tag: 'dynamic-one',
    template: (
      <div
        className={classes.row}
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
    ),
  }) {
    static observedTriggers = new Set(['disable'])
    plait({ feedback, $, connect }: PlaitProps) {
      connect(msg)
      feedback({
        disable() {
          const button = $<HTMLButtonElement>('button')
          button && (button.disabled = true)
        },
        click() {
          msg('two', {
            type: 'add',
            detail: { value: ' World!' },
          })
        },
      })
    }
  }
  class ElTwo extends Component({
    tag: 'dynamic-two',
    dev: true,
    template: (
      <h1
        data-target='header'
        {...stylesheet}
      >
        Hello
      </h1>
    ),
  }) {
    static observedTriggers = new Set(['add'])
    plait({ $, feedback, addThreads, thread, sync, connect }: PlaitProps) {
      connect(msg)
      addThreads({
        onAdd: thread(sync({ waitFor: { type: 'add' } }), sync({ request: { type: 'disable' } })),
      })
      feedback({
        disable() {
          msg('one', { type: 'disable' })
        },
        add(detail: { value: string }) {
          const header = $('header')
          header?.insertAdjacentHTML('beforeend', `${detail.value}`)
        },
      })
    }
  }
  // Create elements and append to dom
  const one = document.createElement(ElOne.tag)
  const two = document.createElement(ElTwo.tag)
  one.setAttribute(dataAddress, 'one')
  two.setAttribute(dataAddress, 'two')
  wrapper.insertAdjacentElement('beforeend', one)
  wrapper.insertAdjacentElement('beforeend', two)

  // Define elements
  customElements.define(ElOne.tag, ElOne)
  customElements.define(ElTwo.tag, ElTwo)

  let button = await t.findByAttribute('data-target', 'button', wrapper)
  const header = await t.findByAttribute('data-target', 'header', wrapper)
  t({
    given: 'render',
    should: 'header should contain string',
    actual: header?.innerHTML,
    expected: 'Hello',
  })
  button && (await t.fireEvent(button, 'click'))
  t({
    given: 'clicking button',
    should: 'append string to header',
    actual: header?.innerHTML,
    expected: 'Hello World!',
  })
  button = await t.findByAttribute('data-target', 'button', wrapper)
  t({
    given: 'clicking button',
    should: 'be disabled',
    actual: (button as HTMLButtonElement)?.disabled,
    expected: true,
  })
})
