import { useSignal } from 'plaited'
import { bElement } from 'plaited/ui'

const sendDisable = useSignal()
const sendAdd = useSignal<{ value: string }>()

export const SignalSender = bElement({
  tag: 'signal-sender',
  publicEvents: ['disable'],
  shadowDom: (
    <div>
      <button
        type='button'
        p-target='button'
        p-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bProgram({ $, trigger }) {
    const disconnect = sendDisable.listen('disable', trigger)
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button?.attr('disabled', true)
        disconnect()
      },
      click() {
        sendAdd.set({ value: ' World!' })
      },
    }
  },
})

export const SignalReceiver = bElement({
  tag: 'signal-receiver',
  publicEvents: ['add'],
  shadowDom: <h1 p-target='header'>Hello</h1>,
  bProgram({ $, bThread, bThreads, bSync, trigger }) {
    sendAdd.listen('add', trigger)
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      disable() {
        sendDisable.set()
      },
      add(detail: { value: string }) {
        const [header] = $('header')
        header?.insert('beforeend', detail.value)
      },
    }
  },
})
