import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { usePublisher } from '../../utils-client.js'

test('usePublisher: sub before pub then disconnect', () => {
  const pub = usePublisher()
  const spy = sinon.spy()
  const disconnect = pub.sub('a', spy)
  pub({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  disconnect()
  pub({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
})
test('usePublisher: pub before sub then disconnect', () => {
  const pub = usePublisher()
  const spy = sinon.spy()
  pub({ value: 4 })
  const disconnect = pub.sub('b', spy)
  pub({ value: 4 })
  disconnect()
  expect(spy.calledTwice).toBeFalse()
})
test('usePublisher: sub then disconnect before pub', () => {
  const pub = usePublisher()
  const spy = sinon.spy()
  const disconnect = pub.sub('b', spy)
  disconnect()
  pub({ value: 4 })
  expect(spy.called).toBeFalse()
})
