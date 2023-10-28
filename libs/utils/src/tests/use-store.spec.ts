import { expect, test } from '@jest/globals'
import sinon from 'sinon'
import { useStore } from '../index.js'

test('useStore()', () => {
  const [ store, setStore ] = useStore<Record<string, number> | number>({ a: 1 })
  setStore(prev => {
    if (typeof prev !== 'number') prev.b = 2
    return prev
  })
  expect(store()).toEqual({ a: 1, b: 2 })
  setStore(3)
  expect(store()).toEqual(3)
})

test('useStore(): with subscription', () => {
  const [ store, setStore ] = useStore<number>(2)
  const callback = sinon.spy()
  const disconnect = store.subscribe(callback)
  setStore(prev => prev + 1)
  expect(store()).toEqual(3)
  expect(callback.args).toEqual([ [ 3 ] ])
  setStore(4)
  expect(store()).toEqual(4)
  expect(callback.callCount).toEqual(2)
  disconnect()
  setStore(7)
  expect(callback.callCount).toEqual(2)
})
