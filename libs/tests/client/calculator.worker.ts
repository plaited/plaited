import { bProgram, bThread, loop, sync, useIndexedDB, useMain } from '$plaited'

const { trigger, add, feedback } = bProgram()

const { send } = useMain({ context: self, trigger })

add({
  onPercent: loop(bThread(
    sync<{ num1: number; num2: number; operation: string }>({
      block: {
        cb: ({ detail }) => {
          return !['add', 'minus', 'multiply', 'divide'].includes(
            detail.operation,
          )
        },
      },
    }),
  )),
})

feedback({
  async percent(
    {
      num,
      operation,
    }: {
      num: number
      operation: 'add' | 'minus' | 'multiply' | 'divide'
    },
  ) {
    const [get] = await useIndexedDB<number>('memory')
    const mem = await get()
    trigger({
      event: operation,
      detail: { num: (num / 100) * mem },
    })
  },
  async squareRoot(detail: { num: number }) {
    const [_, set] = await useIndexedDB<number>('memory')
    const value = Math.sqrt(detail.num)
    await set(value)
    send('value-display', {
      event: 'updateValue',
      detail: { value },
    })
  },
  async clear() {
    const [_, set] = await useIndexedDB<number>('memory')
    await set(0)
  },
  async add({ num }: { num: number }) {
    const [get, set] = await useIndexedDB<number>('memory')
    await set((old) => old ? old + num : num)
    const value = await get()
    send('value-display', {
      event: 'updateValue',
      detail: { value },
    })
  },
  async minus({ num }: { num: number }) {
    const [get, set] = await useIndexedDB<number>('memory')
    await set((old) => old ? old - num : num)
    const value = await get()
    send('value-display', {
      event: 'updateValue',
      detail: { value },
    })
  },
  async multiply({ num }: { num: number }) {
    const [get, set] = await useIndexedDB<number>('memory')
    await set((old) => old ? old * num : num)
    const value = await get()
    send('value-display', {
      event: 'updateValue',
      detail: { value },
    })
  },
  async divide({ num }: { num: number }) {
    const [get, set] = await useIndexedDB<number>('memory')
    await set((old) => old ? old / num : num)
    const value = await get()
    send('value-display', {
      event: 'updateValue',
      detail: { value },
    })
  },
})
