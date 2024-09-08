import { defineTemplate } from '../define-template.js'
import { useStore } from '../use-store.js'

const pub = useStore<number>(0)

export const Publisher = defineTemplate({
  tag: 'publisher-component',
  shadowDom: (
    <button
      p-trigger={{ click: 'increment' }}
      p-target='button'
    >
      increment
    </button>
  ),
  publicEvents: ['add'],
  connectedCallback({ bThreads, bThread, bSync }) {
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      increment() {
        pub(pub.get() + 1)
      },
    }
  },
})

export const Subscriber = defineTemplate({
  tag: 'subscriber-component',
  shadowDom: <h1 p-target='count'>{pub.get()}</h1>,
  publicEvents: ['update'],
  connectedCallback({ $, subscribe }) {
    subscribe(pub, 'update')
    return {
      update(value: number) {
        const [count] = $('count')
        count.render(`${value}`)
      },
    }
  },
})
