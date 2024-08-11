import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { defineTemplate } from '../define-template.js'
import { getPlaitedChildren } from '../../index.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

const Inner = defineTemplate({
  tag: 'inner-component',
  shadowDom: <h1 bp-target='header'>Hello</h1>,
  publicEvents: ['add'],
  connectedCallback({ $, rules, thread, sync, emit }) {
    rules.set({
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

const Outer = defineTemplate({
  tag: 'outer-component',
  shadowDom: (
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
  connectedCallback({ $ }) {
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && (button.disabled = true)
      },
      click() {
        const [slot] = $<HTMLSlotElement>('slot')
        const [el] = getPlaitedChildren(slot)
        el.trigger({ type: 'add', detail: ' World!' })
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
