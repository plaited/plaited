import { css } from '@plaited/jsx'
import { test } from '@plaited/rite'
import { PlaitProps } from '@plaited/component-types'
import { Component } from '../index.js'

test('observed triggers', async (t) => {
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

  class Bottom extends Component({
    tag: 'bottom-component',
    dev: true,
    template: (
      <h1
        data-target='header'
        {...stylesheet}
      >
        Hello
      </h1>
    ),
    observedTriggers: ['add'],
  }) {
    plait({ $, feedback, addThreads, thread, sync, emit }: PlaitProps) {
      addThreads({
        onAdd: thread(sync({ waitFor: { type: 'add' } }), sync({ request: { type: 'disable' } })),
      })
      feedback({
        disable() {
          emit({ type: 'disable', bubbles: true })
        },
        add(detail: string) {
          const [header] = $('header')
          header.insert('beforeend', `${detail}`)
        },
      })
    }
  }

  class Top extends Component({
    tag: 'top-component',
    template: (
      <div
        className={classes.row}
        {...stylesheet}
      >
        <slot
          data-target='slot'
          data-trigger={{ disable: 'disable' }}
        ></slot>
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
    plait({ feedback, $ }: PlaitProps) {
      feedback({
        disable() {
          const [button] = $<HTMLButtonElement>('button')
          button && (button.disabled = true)
        },
        click() {
          const [slot] = $<HTMLSlotElement>('slot')
          for (const el of slot.assignedElements()) {
            if (el instanceof Bottom) {
              el.trigger({ type: 'add', detail: ' World!' })
              break
            }
          }
        },
      })
    }
  }

  // Create elements and append to dom
  const top = document.createElement(Top.tag)
  const bottom = document.createElement(Bottom.tag)
  wrapper.insertAdjacentElement('beforeend', top)
  top.insertAdjacentElement('beforeend', bottom)

  // // Define elements
  customElements.define(Top.tag, Top)
  customElements.define(Bottom.tag, Bottom)

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
