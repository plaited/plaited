import { test } from '@plaited/rite'
import { bpAddress } from '../../jsx/constants.js'
import { Component } from '../component.js'
import { useMessenger, useEventSources } from '../utils.js'

test('dynamic island comms', async (t) => {
  const msg = useMessenger()
  const wrapper = document.querySelector('body')
  const ElOne = Component({
    tag: 'dynamic-one',
    observedTriggers: ['disable'],
    template: (
      <div>
        <button
          bp-target='button'
          bp-trigger={{ click: 'click' }}
        >
          Add "world!"
        </button>
      </div>
    ),
    bp({ feedback, $, root, trigger }) {
      const connect = useEventSources(root, trigger)
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
    observedTriggers: ['add'],
    template: <h1 bp-target='header'>Hello</h1>,
    bp({ $, feedback, addThreads, thread, sync, root, trigger }) {
      const connect = useEventSources(root, trigger)
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
  one.setAttribute(bpAddress, 'one')
  two.setAttribute(bpAddress, 'two')
  wrapper.insertAdjacentElement('beforeend', one)
  wrapper.insertAdjacentElement('beforeend', two)

  // Define elements
  ElOne.define()
  ElTwo.define()

  let button = await t.findByAttribute('bp-target', 'button', wrapper)
  const header = await t.findByAttribute('bp-target', 'header', wrapper)
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
  button = await t.findByAttribute('bp-target', 'button', wrapper)
  t({
    given: 'clicking button',
    should: 'be disabled',
    actual: (button as HTMLButtonElement)?.disabled,
    expected: true,
  })
})
