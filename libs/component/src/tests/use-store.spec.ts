import { test } from '@plaited/rite'
import sinon from 'sinon'
import { useStore } from '../index.js'

test('useStore()', (t) => {
  const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
  setStore((prev) => {
    if (typeof prev !== 'number') prev.b = 2
    return prev
  })
  t({
    given: 'updating storing object via a merge callback',
    should: 'have initial value and new value',
    actual: store(),
    expected: { a: 1, b: 2 },
  })
  setStore(3)
  t({ given: 'overwriting store', should: 'have only new value', actual: store(), expected: 3 })
})

test('useStore(): with subscription', (t) => {
  const [store, setStore] = useStore<number>(2)
  const callback = sinon.spy()
  const disconnect = store.subscribe(callback)
  setStore((prev) => prev + 1)
  t({ given: 'updating store value', should: 'have new value', actual: store(), expected: 3 })
  t({
    given: 'subscribing to stor updates',
    should: 'get called with new value',
    actual: callback.args,
    expected: [[3]],
  })
  setStore(4)
  t({
    given: 'setting value again',
    should: 'get called again with new value',
    actual: callback.args,
    expected: [[3], [4]],
  })
  t({ given: 'setting store twice', should: 'be called twice', actual: callback.callCount, expected: 2 })
  disconnect()
  setStore(7)
  t({
    given: 'disconnecting from store before setting store again',
    should: 'be only called twice',
    actual: callback.callCount,
    expected: 2,
  })
})
