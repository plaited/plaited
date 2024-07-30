import { defineTemplate } from '../../index.js'
import { usePublisher } from '../use-publisher.js'

const sendDisable = usePublisher()
const sendAdd = usePublisher<{ value: string }>()
export const ElOne = defineTemplate({
  tag: 'dynamic-one',
  publicEvents: ['disable'],
  shadowRoot: (
    <div>
      <button
        bp-target='button'
        bp-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bp({ $, host }) {
    const disconnect = sendDisable.sub(host, 'disable')
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
  shadowRoot: <h1 bp-target='header'>Hello</h1>,
  bp({ $, addThreads, thread, sync, host }) {
    sendAdd.sub(host, 'add')
    addThreads({
      onAdd: thread(sync({ waitFor: 'add' }), sync({ request: { type: 'disable' } })),
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
