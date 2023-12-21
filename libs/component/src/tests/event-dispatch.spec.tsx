import { test } from '@plaited/rite'
import { PlaitProps } from '@plaited/component-types'
import { Component } from '../index.js'

test('eventTriggers', async (t) => {
  const wrapper = document.querySelector('body')

  const Bottom = Component({
    tag: 'bottom-component',
    dev: true,
    template: (
      <button
        data-target='button'
        data-trigger={{ click: 'click' }}
      >
        Add
      </button>
    ),
    observedTriggers: ['add'],
    bp({ feedback, emit }: PlaitProps) {
      feedback({
        click() {
          emit({ type: 'append' })
        },
      })
    },
  })

  const Top = Component({
    tag: 'top-component',
    dev: true,
    template: (
      <div>
        <h1 data-target='header'>Hello</h1>
        <Bottom data-trigger={{ append: 'append' }}></Bottom>
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
  wrapper.insertAdjacentElement('beforeend', top)

  // // Define elements
  Top.define()

  const button = await t.findByAttribute('data-target', 'button', wrapper)
  const header = await t.findByAttribute('data-target', 'header', wrapper)
  t({
    given: 'render',
    should: 'header should contain string',
    actual: header?.textContent,
    expected: 'Hello',
  })
  button && (await t.fireEvent(button, 'click'))
  t({
    given: 'clicking button',
    should: 'append string to header',
    actual: header?.textContent,
    expected: 'Hello World!',
  })
})
