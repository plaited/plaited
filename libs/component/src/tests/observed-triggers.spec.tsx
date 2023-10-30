import { css } from '@plaited/jsx'
import { test } from '@plaited/rite'
import { Component, PlaitProps } from '../index.js'

test('dynamic island comms', async t => {
  const [ classes, stylesheet ] = css`.row {
  display: flex;
  gap: 10px;
  padding: 12px;
}
.button {
  height: 18px;
  width: auto;
}`
  const wrapper = document.querySelector('body')

  class Bottom extends Component({
    tag: 'bottom-component',
    observedTriggers: { add: 'add' },
    dev: true,
    template: <h1 data-target='header'
      {...stylesheet}
    >Hello</h1>,
  }) {
    plait({ $, feedback, addThreads, thread, sync, host }: PlaitProps) {
      addThreads({
        onAdd: thread(
          sync({ waitFor: { type: 'add' } }),
          sync({ request: { type: 'disable' } })
        ),
      })
      feedback({
        disable() {
          host.dispatchEvent(new CustomEvent('disable', { bubbles: true }))
        },
        add({ detail }: CustomEvent) {
          const header = $('header')
          header?.insertAdjacentHTML('beforeend', `${detail}`)
        },
      })
    }
  }

  class Top extends Component({
    tag: 'top-component',
    template: <div className={classes.row}
      {...stylesheet}
    >
      <slot data-target='slot'
        data-trigger={{ disable: 'disable' }}
      ></slot>
      <button
        data-target='button'
        className={classes.button}
        data-trigger={{ click: 'click' }}
      >
          Add "world!"
      </button>
    </div>, 
  }) {
    plait({ feedback, $ }: PlaitProps) {
      feedback({
        disable() {
          console.log('hit')
          const button = $<HTMLButtonElement>('button')
          button && (button.disabled = true)
        },
        click() {
          const slot = $<HTMLSlotElement>('slot')
          for(const el of slot.assignedElements()){
            if(el instanceof Bottom){
              el.dispatchEvent(new CustomEvent('add', { detail: ' World!' }))
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
  button && await t.fireEvent(button, 'click')
  t({
    given: 'clicking button',
    should: 'append string to header',
    actual: header?.innerHTML,
    expected: 'Hello World!',
  })
  button = await t.findByAttribute(
    'data-target',
    'button',
    wrapper
  )
  t({
    given: 'clicking button',
    should: 'be disabled',
    actual: (button as HTMLButtonElement)?.disabled,
    expected: true,
  })
})
