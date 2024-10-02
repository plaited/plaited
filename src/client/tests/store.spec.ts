import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { useStore } from '../use-store.js'

test('useStore: effect before store then disconnect', () => {
  const store = useStore<{ value: number }>({ value: 0 })
  const spy = sinon.spy()
  const disconnect = store.effect('a', spy)
  store({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  disconnect()
  store({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
})

test('useStore: store before effect then disconnect', () => {
  const spy = sinon.spy()
  const store = useStore<{ value: number }>({ value: 0 })
  store({ value: 4 })
  const disconnect = store.effect('b', spy)
  store({ value: 4 })
  disconnect()
  expect(spy.calledTwice).toBeFalse()
})

test('useStore: effect then disconnect before store', () => {
  const spy = sinon.spy()
  const store = useStore<{ value: number }>({ value: 0 })
  const disconnect = store.effect('b', spy)
  disconnect()
  store({ value: 4 })
  expect(spy.called).toBeFalse()
})
