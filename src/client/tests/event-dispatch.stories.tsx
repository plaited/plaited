import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { defineTemplate } from '../define-template.js'

const meta: Meta = {
  title: 'Tests',
  component: () => <></>,
}

export default meta

const Bottom = defineTemplate({
  tag: 'bottom-component',
  shadowDom: (
    <button
      p-target='button'
      p-trigger={{ click: 'click' }}
    >
      Add
    </button>
  ),
  publicEvents: ['add'],
  connectedCallback({ $ }) {
    return {
      click() {
        $.dispatch({ type: 'append' })
      },
    }
  },
})

const Top = defineTemplate({
  tag: 'top-component',
  shadowDom: (
    <div>
      <h1 p-target='header'>Hello</h1>
      <Bottom p-trigger={{ append: 'append' }}></Bottom>
    </div>
  ),
  connectedCallback({ $ }) {
    return {
      append() {
        const [header] = $('header')
        header.insert('beforeend', <> World!</>)
      },
    }
  },
})

export const eventDispatch: StoryObj = {
  render: () => (
    <>
      <Top />
    </>
  ),
  play: async () => {
    const button = await findByAttribute('p-target', 'button')
    const header = await findByAttribute('p-target', 'header')
    assert({
      given: 'render',
      should: 'header should contain string',
      actual: header?.textContent,
      expected: 'Hello',
    })
    button && (await fireEvent(button, 'click'))
    console.log(header?.textContent)
    assert({
      given: 'clicking button',
      should: 'append string to header',
      actual: header?.textContent,
      expected: 'Hello World!',
    })
  },
}
