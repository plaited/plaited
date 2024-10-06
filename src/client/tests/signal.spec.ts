import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { useSignal } from '../use-signal.js'

test('useSignal: effect before store then disconnect', () => {
  const store = useSignal<{ value: number }>({ value: 0 })
  const spy = sinon.spy()
  const disconnect = store.effect('a', spy)
  store({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  disconnect()
  store({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
})

test('useSignal: store before effect then disconnect', () => {
  const spy = sinon.spy()
  const store = useSignal<{ value: number }>({ value: 0 })
  store({ value: 4 })
  const disconnect = store.effect('b', spy)
  store({ value: 4 })
  disconnect()
  expect(spy.calledTwice).toBeFalse()
})

test('useSignal: effect then disconnect before store', () => {
  const spy = sinon.spy()
  const store = useSignal<{ value: number }>({ value: 0 })
  const disconnect = store.effect('b', spy)
  disconnect()
  store({ value: 4 })
  expect(spy.called).toBeFalse()
})
