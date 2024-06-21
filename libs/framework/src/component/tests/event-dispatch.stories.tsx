import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { Component } from '../component.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

export const eventDispatch: StoryObj = {
  play: async ({ canvasElement }) => {
    const Bottom = Component({
      tag: 'bottom-component',
      template: (
        <button
          bp-target='button'
          bp-trigger={{ click: 'click' }}
        >
          Add
        </button>
      ),
      observedTriggers: ['add'],
      bp({ feedback, emit }) {
        feedback({
          click() {
            emit({ type: 'append' })
          },
        })
      },
    })

    const Top = Component({
      tag: 'top-component',
      template: (
        <div>
          <h1 bp-target='header'>Hello</h1>
          <Bottom bp-trigger={{ append: 'append' }}></Bottom>
        </div>
      ),
      bp({ feedback, $ }) {
        feedback({
          append() {
            const [header] = $('header')
            header.insert('beforeend', <> World!</>)
          },
        })
      },
    })

    // Create elements and append to dom
    const top = document.createElement(Top.tag)
    canvasElement.insertAdjacentElement('beforeend', top)

    // // Define elements
    Top.define()

    const button = await findByAttribute('bp-target', 'button')
    const header = await findByAttribute('bp-target', 'header')
    assert({
      given: 'render',
      should: 'header should contain string',
      actual: header?.textContent,
      expected: 'Hello',
    })
    button && (await fireEvent(button, 'click'))
    console.log(header?.textContent)
    assert({
      given: 'clicking button',
      should: 'append string to header',
      actual: header?.textContent,
      expected: 'Hello World!',
    })
  },
}
