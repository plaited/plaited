import { Component } from '../../index.js'
import { useMessenger } from '../../utils.js'

const msg = useMessenger()

export const ElOne = Component({
  tag: 'dynamic-one',
  observedTriggers: ['disable'],
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
  bp({ feedback, $, connect }) {
    const disconnect = connect(msg)
    feedback({
      disable() {
        const [button] = $<HTMLButtonElement>('button')
        button && button.attr('disabled', true)
        disconnect()
      },
      click() {
        msg({
          address: 'two',
          event: {
            type: 'add',
            detail: { value: ' World!' },
          },
        })
      },
    })
  },
})

export const ElTwo = Component({
  tag: 'dynamic-two',
  observedTriggers: ['add'],
  template: <h1 bp-target='header'>Hello</h1>,
  bp({ $, feedback, addThreads, thread, sync, connect }) {
    connect(msg)
    addThreads({
      onAdd: thread(sync({ waitFor: 'add' }), sync({ request: { type: 'disable' } })),
    })
    feedback({
      disable() {
        msg({ address: 'one', event: { type: 'disable' } })
      },
      add(detail: { value: string }) {
        const [header] = $('header')
        header.insert('beforeend', <>{detail.value}</>)
      },
    })
  },
})
