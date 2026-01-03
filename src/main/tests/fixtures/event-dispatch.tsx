import { bElement } from 'plaited'

export const EmitButton = bElement({
  tag: 'emit-button',
  shadowDom: (
    <button
      type='button'
      p-target='button'
      p-trigger={{ click: 'click' }}
    >
      Add
    </button>
  ),
  publicEvents: ['add'],
  bProgram({ emit }) {
    return {
      click() {
        emit({ type: 'append', bubbles: true, composed: true })
      },
    }
  },
})

export const ShadowHost = bElement({
  tag: 'shadow-host',
  shadowDom: (
    <div>
      <h1 p-target='header'>Hello</h1>
      <EmitButton p-trigger={{ append: 'append' }}></EmitButton>
    </div>
  ),
  bProgram({ $ }) {
    return {
      append() {
        const [header] = $('header')
        header?.insert('beforeend', <> World!</>)
      },
    }
  },
})

export const SlotHost = bElement({
  tag: 'slot-host',
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
        header?.insert('beforeend', <> World!</>)
      },
    }
  },
})
