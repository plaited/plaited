import { defineTemplate, type FT, useSignal } from 'plaited'

const sendDisable = useSignal()
const sendAdd = useSignal<{ value: string }>()

export const ElOne = defineTemplate({
  tag: 'elemenmt-one',
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
  bProgram({ $, trigger }) {
    const disconnect = sendDisable.listen('disable', trigger)
    return {
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && button.attr('disabled', true)
        disconnect()
      },
      click() {
        sendAdd.set({ value: ' World!' })
      },
    }
  },
})

export const ElTwo = defineTemplate({
  tag: 'element-two',
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
        header.insert('beforeend', <>{detail.value}</>)
      },
    }
  },
})

export const ComponentComms: FT = () => {
  return (
    <>
      <ElOne />
      <ElTwo />
    </>
  )
}
