import { test, expect } from 'bun:test'
import { useConnect } from '../use-connect.js'
import sinon from 'sinon'
import { usePublisher } from '../../utils-client.js'
import { Disconnect } from '../../types.js'

test('useConnect: with usePublisher', () => {
  const disconnectSet = new Set<Disconnect>()
  const pub = usePublisher()
  const spy = sinon.spy()
  // @ts-expect-error: just testing publisher
  const disconnect = useConnect({ trigger: spy, disconnectSet })('a', pub)
  pub({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  expect(disconnectSet.size).toBe(1)
  disconnect()
  pub({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
  expect(disconnectSet.size).toBe(0)
})
