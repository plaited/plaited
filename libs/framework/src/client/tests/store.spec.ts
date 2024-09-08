import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { useStore } from '../use-store.js'

test('useStore: sub before pub then disconnect', () => {
  const pub = useStore<{ value: number }>()
  const spy = sinon.spy()
  const disconnect = pub.sub('a', spy)
  pub({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  disconnect()
  pub({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
})

test('useStore: pub before sub then disconnect', () => {
  const spy = sinon.spy()
  const pub = useStore<{ value: number }>()
  pub({ value: 4 })
  const disconnect = pub.sub('b', spy)
  pub({ value: 4 })
  disconnect()
  expect(spy.calledTwice).toBeFalse()
})

test('useStore: sub then disconnect before pub', () => {
  const spy = sinon.spy()
  const pub = useStore<{ value: number }>()
  const disconnect = pub.sub('b', spy)
  disconnect()
  pub({ value: 4 })
  expect(spy.called).toBeFalse()
})
