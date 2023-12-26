import { test } from '@plaited/rite'
import { Component } from '../component.js'

test('eventTriggers', async (t) => {
  const wrapper = document.querySelector('body')

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
  wrapper.insertAdjacentElement('beforeend', top)

  // // Define elements
  Top.define()

  const button = await t.findByAttribute('bp-target', 'button', wrapper)
  const header = await t.findByAttribute('bp-target', 'header', wrapper)
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
