import { defineTemplate } from '../../index.js'
import { usePublisher } from '../use-publisher.js'

const sendDisable = usePublisher()
const sendAdd = usePublisher<{ value: string }>()

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
  connectedCallback({ $, connect }) {
    const disconnect = connect(sendDisable, 'disable')
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
  connectedCallback({ $, sync, bThreads, point, connect }) {
    connect(sendAdd, 'add')
    bThreads.set({
      onAdd: sync([point({ waitFor: 'add' }), point({ request: { type: 'disable' } })]),
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

