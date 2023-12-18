import { test } from '@plaited/rite'
import { Component, isPlaited } from '../index.js'
import { trueTypeOf } from '@plaited/utils'
import { PlaitedElement } from '@plaited/component-types'
test('observed triggers', async (t) => {
  const wrapper = document.querySelector('body')

  const Bottom = Component({
    tag: 'bottom-component',
    dev: true,
    template: <h1 data-target='header'>Hello</h1>,
    triggers: ['add'],
    plait({ $, feedback, addThreads, thread, sync, emit }) {
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
          data-target='slot'
          data-trigger={{ disable: 'disable' }}
        ></slot>
        <button
          data-target='button'
          data-trigger={{ click: 'click' }}
        >
          Add "world!"
        </button>
      </div>
    ),
    plait({ feedback, $ }) {
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
