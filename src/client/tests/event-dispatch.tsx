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

export const Top = defineTemplate({
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
