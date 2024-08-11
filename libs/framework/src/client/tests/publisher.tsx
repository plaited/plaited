import { defineTemplate } from '../define-template.js'
import { usePublisher } from '../use-publisher.js'

const pub = usePublisher<number>(0)

export const Publisher = defineTemplate({
  tag: 'publisher-component',
  shadowDom: (
    <button
      bp-trigger={{ click: 'increment' }}
      bp-target='button'
    >
      increment
    </button>
  ),
  publicEvents: ['add'],
  connectedCallback({ rules, thread, sync }) {
    rules.set({
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
  shadowDom: <h1 bp-target='count'>{pub.get()}</h1>,
  publicEvents: ['update'],
  connectedCallback({ $, host }) {
    pub.sub(host, 'update')
    return {
      update(value: number) {
        const [count] = $('count')
        count.render(`${value}`)
      },
    }
  },
})
