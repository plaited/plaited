import { Component } from '../../index.js'
import { usePublisher } from '../../client-utils.js'

const sendDisable = usePublisher()
const sendAdd = usePublisher()
export const ElOne = Component({
  tag: 'dynamic-one',
  publicEvents: ['disable'],
  template: (
    <div>
      <button
        bp-target='button'
        bp-trigger={{ click: 'click' }}
      >
        Add "world!"
      </button>
    </div>
  ),
  bp({ $, connect }) {
    const disconnect = connect('disable', sendDisable)
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

export const ElTwo = Component({
  tag: 'dynamic-two',
  publicEvents: ['add'],
  template: <h1 bp-target='header'>Hello</h1>,
  bp({ $, addThreads, thread, sync, connect }) {
    connect('add', sendAdd)
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
