import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { bpAddress } from '../../jsx/constants.js'
import { Component } from '../../index.js'
import { useMessenger } from '../../utils.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

export const componentComms: StoryObj = {
  play: async ({ canvasElement }) => {
    const msg = useMessenger()
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
      bp({ feedback, $, connect }) {
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
      bp({ $, feedback, addThreads, thread, sync, connect }) {
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
    canvasElement.insertAdjacentElement('beforeend', one)
    canvasElement.insertAdjacentElement('beforeend', two)

    // Define elements
    ElOne.define()
    ElTwo.define()

    let button = await findByAttribute('bp-target', 'button')
    const header = await findByAttribute('bp-target', 'header')
    assert({
      given: 'render',
      should: 'header should contain string',
      actual: header?.innerHTML,
      expected: 'Hello',
    })
    button && (await fireEvent(button, 'click'))
    assert({
      given: 'clicking button',
      should: 'append string to header',
      actual: header?.innerHTML,
      expected: 'Hello World!',
    })
    button = await findByAttribute('bp-target', 'button')
    assert({
      given: 'clicking button',
      should: 'be disabled',
      actual: (button as HTMLButtonElement)?.disabled,
      expected: true,
    })
  },
}
