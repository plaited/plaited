import { defineTemplate } from '../define-template.js'
import { useStore } from '../use-store.js'

const sendDisable = useStore()
const sendAdd = useStore<{ value: string }>()

export const ElOne = defineTemplate({
  tag: 'dynamic-one',
  publicEvents: ['disable'],
  shadowDom: (
    <div>
      <button
        p-target='button'
        p-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  connectedCallback({ $, trigger }) {
    const disconnect = sendDisable.effect('disable', trigger)
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && button.attr('disabled', true)
        disconnect()
      },
      click() {
        sendAdd({ value: ' World!' })
      },
    }
  },
})

export const ElTwo = defineTemplate({
  tag: 'dynamic-two',
  publicEvents: ['add'],
  shadowDom: <h1 p-target='header'>Hello</h1>,
  connectedCallback({ $, bThread, bThreads, bSync, trigger }) {
    sendAdd.effect('add', trigger)
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      disable() {
        sendDisable()
      },
      add(detail: { value: string }) {
        const [header] = $('header')
        header.insert('beforeend', <>{detail.value}</>)
      },
    }
  },
})
