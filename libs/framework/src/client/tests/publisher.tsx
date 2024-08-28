import { defineTemplate } from '../define-template.js'
import { usePublisher } from '../use-publisher.js'

const pub = usePublisher<number>(0)

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
  connectedCallback({ bThreads, sync, point }) {
    bThreads.set({
      onAdd: sync([point({ waitFor: 'add' }), point({ request: { type: 'disable' } })]),
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
