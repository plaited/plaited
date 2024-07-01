import { test, expect } from 'bun:test'
import { connectToPublisher } from '../connect-to-publisher.js'
import sinon from 'sinon'
import { usePublisher } from '../../utils.js'
import { Disconnect } from '../../types.js'

test('connectToPublisher: sub before pub then disconnect', () => {
  const disconnectSet = new Set<Disconnect>()
  const addDisconnect = (cb: Disconnect) => disconnectSet.add(cb)
  const pub = usePublisher()
  const spy = sinon.spy()
  const disconnect = connectToPublisher(spy, addDisconnect)('a', pub)
  pub({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  expect(disconnectSet.size).toBe(1)
  disconnect()
  pub({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
  expect(disconnectSet.size).toBe(0)
})
