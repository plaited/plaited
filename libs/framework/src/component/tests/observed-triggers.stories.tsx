import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { Component } from '../component.js'
import { isPlaitedElement } from '../../utils.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

export const observedTriggers: StoryObj = {
  play: async ({ canvasElement }) => {
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
              if (isPlaitedElement(el)) {
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
    canvasElement.insertAdjacentElement('beforeend', top)
    top.insertAdjacentElement('beforeend', bottom)

    // // Define elements
    Top.define()
    Bottom.define()

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
