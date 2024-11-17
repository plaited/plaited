import type { FT } from '../../jsx/jsx.types.js'
import { defineTemplate } from '../define-template.js'
import { useSignal } from '../use-signal.js'

const store = useSignal<number>(0)

const Publisher = defineTemplate({
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
  bProgram({ bThreads, bThread, bSync }) {
    bThreads.set({
      onAdd: bThread([bSync({ waitFor: 'add' }), bSync({ request: { type: 'disable' } })]),
    })
    return {
      increment() {
        store(store.get() + 1)
      },
    }
  },
})

const Subscriber = defineTemplate({
  tag: 'subscriber-component',
  shadowDom: <h1 p-target='count'>{store.get()}</h1>,
  publicEvents: ['update'],
  bProgram({ $, trigger }) {
    store.effect('update', trigger)
    return {
      update(value: number) {
        const [count] = $('count')
        count.render(`${value}`)
      },
    }
  },
})

export const Fixture: FT = () => (
  <>
    <Publisher />
    <Subscriber />
  </>
)
