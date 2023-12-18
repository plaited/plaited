import { dataAddress } from '@plaited/jsx/utils'
import { test } from '@plaited/rite'
import { Component } from '../index.js'
import { messenger } from '../utils.js'

test('dynamic island comms', async (t) => {
  const msg = messenger()
  const wrapper = document.querySelector('body')
  const ElOne = Component({
    tag: 'dynamic-one',
    observedTriggers: ['disable'],
    template: (
      <div>
        <button
          data-target='button'
          data-trigger={{ click: 'click' }}
        >
          Add "world!"
        </button>
      </div>
    ),
    plait({ feedback, $, connect }) {
      const disconnect = connect(msg)
      feedback({
        disable() {
          const [button] = $<HTMLButtonElement>('button')
          button && button.attr('disabled', true)
          disconnect()
        },
        click() {
          msg('two', {
            type: 'add',
            detail: { value: ' World!' },
          })
        },
      })
    },
  })
  const ElTwo = Component({
    tag: 'dynamic-two',
    dev: true,
    observedTriggers: ['add'],
    template: <h1 data-target='header'>Hello</h1>,
    plait({ $, feedback, addThreads, thread, sync, connect }) {
      connect(msg)
      addThreads({
        onAdd: thread(sync({ waitFor: 'add' }), sync({ request: { type: 'disable' } })),
      })
      feedback({
        disable() {
          msg('one', { type: 'disable' })
        },
        add(detail: { value: string }) {
          const [header] = $('header')
          header.insert('beforeend', <>{detail.value}</>)
        },
      })
    },
  })
  // Create elements and append to dom
  const one = document.createElement(ElOne.tag)
  const two = document.createElement(ElTwo.tag)
  one.setAttribute(dataAddress, 'one')
  two.setAttribute(dataAddress, 'two')
  wrapper.insertAdjacentElement('beforeend', one)
  wrapper.insertAdjacentElement('beforeend', two)

  // Define elements
  ElOne.define()
  ElTwo.define()

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
