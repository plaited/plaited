import { css } from '@plaited/jsx'
import { test } from '@plaited/rite'
import { Component, PlaitProps } from '../index.js'
import { Trigger } from '@plaited/behavioral'
import { useStore } from '@plaited/utils'
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
  class ElOne extends Component({
    tag: 'dynamic-one',
    template: <div className={classes.row}
      {...stylesheet}
    >
      <slot data-trigger={{ slotchange: 'slotchange' }}></slot>
      <button
        data-target='button'
        className={classes.button}
        data-trigger={{ click: 'click' }}
      >
          Add "world!"
      </button>
    </div>, 
  }) {
    plait({ feedback, $, trigger }: PlaitProps) {
      const [ sendChild, setSendChild ] = useStore<Trigger>()
      feedback({
        slotchange(evt: Event) {
          const slotElement = evt.target as HTMLSlotElement
          const assignedNodes = slotElement.assignedElements()
          for (const el of  assignedNodes) {
            if(el instanceof ElTwo) {
              el.dispatchEvent(new CustomEvent('parentConnected', { detail: (sub: Trigger) => {
                console.log('child trigger', sub)
                setSendChild(sub)
                // return trigger
              } }))
              break
            }
          }
        },
        disable() {
          const button = $<HTMLButtonElement>('button')
          button && (button.disabled = true)
        },
        click() {
          // sendChild()({
          //   type: 'add',
          //   detail: { value: ' World!' },
          // })
        },
      })
    }
  }
  class ElTwo extends Component({
    tag: 'dynamic-two',
    observedTriggers: { parentConnected: 'parentConnected' },
    dev: true,
    template: <h1 data-target='header'
      {...stylesheet}
    >Hello</h1>,
  }) {
    plait({ $, feedback, addThreads, thread, sync, trigger }: PlaitProps) {
      const [ sendParent, setSendParent ] = useStore<Trigger>()
      addThreads({
        onAdd: thread(
          sync({ waitFor: { type: 'add' } }),
          sync({ request: { type: 'disable' } })
        ),
      })
      feedback({
        parentConnected(evt: CustomEvent<(sub: Trigger) => Trigger>) {
          const { detail } = evt
          detail(trigger)
          // setSendParent(detail(trigger))
        },
        disable() {
          // sendParent()({ type: 'disable' })
        },
        add(detail: { value: string }) {
          const header = $('header')
          header?.insertAdjacentHTML('beforeend', `${detail.value}`)
        },
      })
    }
  }
  // Create elements and append to dom
  const one = document.createElement(ElOne.tag)
  const two = document.createElement(ElTwo.tag)
  wrapper.insertAdjacentElement('beforeend', one)
  one.insertAdjacentElement('beforeend', two)

  // // Define elements
  customElements.define(ElOne.tag, ElOne)
  customElements.define(ElTwo.tag, ElTwo)

  // let button = await t.findByAttribute('data-target', 'button', wrapper)
  // const header = await t.findByAttribute('data-target', 'header', wrapper)
  // t({
  //   given: 'render',
  //   should: 'header should contain string',
  //   actual: header?.innerHTML,
  //   expected: 'Hello',
  // })
  // button && await t.fireEvent(button, 'click')
  // t({
  //   given: 'clicking button',
  //   should: 'append string to header',
  //   actual: header?.innerHTML,
  //   expected: 'Hello World!',
  // })
  // button = await t.findByAttribute(
  //   'data-target',
  //   'button',
  //   wrapper
  // )
  // t({
  //   given: 'clicking button',
  //   should: 'be disabled',
  //   actual: (button as HTMLButtonElement)?.disabled,
  //   expected: true,
  // })
})
