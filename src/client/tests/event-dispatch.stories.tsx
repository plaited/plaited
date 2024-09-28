import { StoryObj } from '../../workshop/workshop.types.js'
import { defineTemplate } from '../define-template.js'
import { useDispatch } from '../use-dispatch.js'
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
  connectedCallback() {
    const dispatch = useDispatch(this)
    return {
      click() {
        dispatch({ type: 'append' })
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
  template: () => (
    <>
      <Top />
    </>
  ),
  play: async ({ assert, findByAttribute, fireEvent }) => {
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
