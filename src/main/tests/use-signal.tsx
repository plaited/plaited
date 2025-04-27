import { type FT, defineElement, useSignal } from 'plaited'

const store = useSignal<number>(0)

const Publisher = defineElement({
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
        store.set(store.get() + 1)
      },
    }
  },
})

const Subscriber = defineElement({
  tag: 'subscriber-component',
  shadowDom: <h1 p-target='count'>{store.get()}</h1>,
  publicEvents: ['update'],
  bProgram({ $, trigger }) {
    store.listen('update', trigger)
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
