import { bElement, isBehavioralElement } from 'plaited/ui'

const getPlaitedChildren = (slot: HTMLSlotElement) => [...slot.assignedElements()].filter(isBehavioralElement)

export const EventEmitter = bElement({
  tag: 'event-emitter',
  shadowDom: <h1 p-target='header'>Hello</h1>,
  publicEvents: ['add'],
  bProgram({ $, bThreads, bThread, bSync, emit }) {
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      disable() {
        emit({ type: 'disable', bubbles: true })
      },
      add(detail: string) {
        const [header] = $('header')
        header?.insert('beforeend', detail)
      },
    }
  },
})

export const EventListener = bElement({
  tag: 'event-listener',
  shadowDom: (
    <div>
      <slot
        p-target='slot'
        p-trigger={{ disable: 'disable' }}
      ></slot>
      <button
        type='button'
        p-target='button'
        p-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bProgram({ $ }) {
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        if (button) button.disabled = true
      },
      click() {
        const [slot] = $<HTMLSlotElement>('slot')
        const [el] = getPlaitedChildren(slot ?? ({} as HTMLSlotElement))
        el?.trigger({ type: 'add', detail: ' World!' })
      },
    }
  },
})
