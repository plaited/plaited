import { bElement, useDispatch } from 'plaited'

export const Nested = bElement({
  tag: 'nested-el',
  shadowDom: (
    <button
      p-target='button'
      p-trigger={{ click: 'click' }}
    >
      Add
    </button>
  ),
  publicEvents: ['add'],
  bProgram({ host }) {
    const dispatch = useDispatch(host)
    return {
      click() {
        dispatch({ type: 'append', bubbles: true, composed: true })
      },
    }
  },
})

export const Outer = bElement({
  tag: 'outer-el',
  shadowDom: (
    <div>
      <h1 p-target='header'>Hello</h1>
      <Nested p-trigger={{ append: 'append' }}></Nested>
    </div>
  ),
  bProgram({ $ }) {
    return {
      append() {
        const [header] = $('header')
        header.insert('beforeend', <> World!</>)
      },
    }
  },
})

export const Slotted = bElement({
  tag: 'parent-el',
  shadowDom: (
    <div>
      <h1 p-target='header'>Hello</h1>
      <slot p-trigger={{ append: 'append' }}></slot>
    </div>
  ),
  bProgram({ $ }) {
    return {
      append() {
        const [header] = $('header')
        header.insert('beforeend', <> World!</>)
      },
    }
  },
})
