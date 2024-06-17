import { test } from '@plaited/rite'
import { Component } from '../../src/index.js'
import { isPlaited } from '../../src/utils.js'
test('observed triggers', async (t) => {
  const wrapper = document.querySelector('body')

  const Bottom = Component({
    tag: 'bottom-component',
    template: <h1 bp-target='header'>Hello</h1>,
    observedTriggers: ['add'],
    bp({ $, feedback, addThreads, thread, sync, emit }) {
      addThreads({
        onAdd: thread(sync({ waitFor: 'add' }), sync({ request: { type: 'disable' } })),
      })
      feedback({
        disable() {
          emit({ type: 'disable', bubbles: true })
        },
        add(detail: string) {
          const [header] = $('header')
          header.insert('beforeend', <>{detail}</>)
        },
      })
    },
  })

  const Top = Component({
    tag: 'top-component',
    template: (
      <div>
        <slot
          bp-target='slot'
          bp-trigger={{ disable: 'disable' }}
        ></slot>
        <button
          bp-target='button'
          bp-trigger={{ click: 'click' }}
        >
          Add "world!"
        </button>
      </div>
    ),
    bp({ feedback, $ }) {
      feedback({
        disable() {
          const [button] = $<HTMLButtonElement>('button')
          button && (button.disabled = true)
        },
        click() {
          const [slot] = $<HTMLSlotElement>('slot')
          for (const el of slot.assignedElements()) {
            if (isPlaited(el)) {
              el.trigger({ type: 'add', detail: ' World!' })
              break
            }
          }
        },
      })
    },
  })

  // Create elements and append to dom
  const top = document.createElement(Top.tag)
  const bottom = document.createElement(Bottom.tag)
  wrapper.insertAdjacentElement('beforeend', top)
  top.insertAdjacentElement('beforeend', bottom)

  // // Define elements
  Top.define()
  Bottom.define()

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
