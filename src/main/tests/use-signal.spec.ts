import { expect, mock, test } from 'bun:test'
import { useComputed, useSignal } from 'plaited'

test('useSignal:calling listen before setting store then disconnecting', () => {
  const store = useSignal<{ value: number }>({ value: 0 })
  const spy = mock()
  const disconnect = store.listen('a', spy)
  store.set({ value: 4 })
  expect(spy).toHaveBeenCalledWith({ type: 'a', detail: { value: 4 } })
  disconnect()
  store.set({ value: 5 })
  expect(spy).toHaveBeenCalledTimes(1)
})

test('useSignal:setting store before calling listen then disconnecting', () => {
  const spy = mock()
  const store = useSignal<{ value: number }>({ value: 0 })
  store.set({ value: 4 })
  const disconnect = store.listen('b', spy)
  store.set({ value: 4 })
  disconnect()
  expect(spy).toHaveBeenCalledTimes(1)
})

test('useSignal: calling listen then disconnecting before setting store', () => {
  const spy = mock()
  const store = useSignal<{ value: number }>({ value: 0 })
  const disconnect = store.listen('b', spy)
  disconnect()
  store.set({ value: 4 })
  expect(spy).not.toHaveBeenCalled()
})

test('validate useComputed function as expected', () => {
  const spy = mock()
  const store = useSignal<number>(1)
  const computed = useComputed<number>(() => store.get() + 2, [store])
  const disconnect = computed.listen('b', spy)
  expect(store.get()).toBe(1)
  store.set(3)
  expect(spy).toHaveBeenCalledWith({ type: 'b', detail: 5 })
  disconnect()
  store.set(6)
  expect(spy).not.toHaveBeenCalledWith({ type: 'b', detail: 8 })
})
