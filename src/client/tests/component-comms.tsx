import { defineTemplate } from '../define-template.js'
import { useSignal } from '../use-signal.js'
import { FT } from 'src/jsx/jsx.types.js'
const sendDisable = useSignal()
const sendAdd = useSignal<{ value: string }>()

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

export const ComponentComms: FT = () => {
  return (
    <>
      <ElOne bp-address='one' />
      <ElTwo bp-address='two' />
    </>
  )
}
