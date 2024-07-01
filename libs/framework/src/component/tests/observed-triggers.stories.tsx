import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { Component } from '../component.js'
import { isPlaitedElement } from '../../utils.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

const Inner = Component({
  tag: 'inner-component',
  template: <h1 bp-target='header'>Hello</h1>,
  publicEvents: ['add'],
  bp({ $, addThreads, thread, sync, emit }) {
    addThreads({
      onAdd: thread(sync({ waitFor: 'add' }), sync({ request: { type: 'disable' } })),
    })
    return {
      disable() {
        emit({ type: 'disable', bubbles: true })
      },
      add(detail: string) {
        const [header] = $('header')
        header.insert('beforeend', <>{detail}</>)
      },
    }
  },
})

const Outer = Component({
  tag: 'outer-component',
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
  bp({ $ }) {
    return {
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
    }
  },
})

export const publicEvents: StoryObj = {
  render: () => (
    <>
      <Outer>
        <Inner />
      </Outer>
    </>
  ),
  play: async () => {
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
