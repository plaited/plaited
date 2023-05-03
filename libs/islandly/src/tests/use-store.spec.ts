import { test } from '@plaited/rite'
import sinon from 'sinon'
import { useStore } from '../index.js'

test('useStore()', t => {
  const [ store, setStore ] = useStore<Record<string, number> | number>({ a: 1 })
  setStore(prev => {
    if (typeof prev !== 'number') prev.b = 2
    return prev
  })
  t({
    given: 'updating store with callback',
    should: 'return new value when getter invoked',
    actual: store(),
    expected:{ a: 1, b: 2 },
  })
  setStore(3)
  t({
    given: 'updating store with value',
    should: 'return new value when getter invoked',
    actual: store(),
    expected:3,
  })
})

test('useStore(): with subscription', t => {
  const [ store, setStore ] = useStore<number>(2)
  const callback = sinon.spy()
  const disconnect = store.subscribe(callback)
  setStore(prev => prev + 1)
  t({
    given: 'updating store with callback',
    should: 'return new value when getter invoked',
    actual: store(),
    expected:3,
  })
  t({
    given: 'subscription to update',
    should: 'return new value when getter invoked',
    actual: callback.args,
    expected:[ [ 3 ] ],
  })
  setStore(4)
  t({
    given: 'setting store value',
    should: 'return new value when getter invoked',
    actual: store(),
    expected:4,
  })
  t({
    given: 'setting store value',
    should: 'return new value when getter invoked',
    actual: callback.callCount,
    expected:2,
  })
  disconnect()
})
