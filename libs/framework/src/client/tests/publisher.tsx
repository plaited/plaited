import { defineTemplate } from '../define-template.js'
import { usePublisher } from '../use-publisher.js'

const pub = usePublisher<number>(0)

export const Publisher = defineTemplate({
  tag: 'publisher-component',
  shadowRoot: (
    <button
      bp-trigger={{ click: 'increment' }}
      bp-target='button'
    >
      increment
    </button>
  ),
  publicEvents: ['add'],
  bp({ addThreads, thread, sync }) {
    addThreads({
      onAdd: thread(sync({ waitFor: 'add' }), sync({ request: { type: 'disable' } })),
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
  shadowRoot: <h1 bp-target='count'>{pub.get()}</h1>,
  publicEvents: ['update'],
  bp({ $, host }) {
    pub.sub(host, 'update')
    return {
      update(value: number) {
        const [count] = $('count')
        count.render(`${value}`)
      },
    }
  },
})
