import { test, expect } from 'bun:test'
import { wait } from '@plaited/utils'
import sinon from 'sinon'
import { useMessenger } from '../../utils.js'

test('messenger: connect, send, close', async () => {
  const msg = useMessenger()
  const spy = sinon.spy()
  const close = msg.connect({
    address: 'actor1',
    trigger: spy,
    observedTriggers: ['a'],
  })
  msg({ address: 'actor1', event: { type: 'a', detail: { value: 4 } } })
  await wait(60)
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  close()
  expect(msg.has('actor1')).toBeFalse()
})
test('messenger: send, connect, close', async () => {
  const msg = useMessenger()
  const spy = sinon.spy()
  msg({ address: 'actor1', event: { type: 'b', detail: { value: 4 } } })
  const close = msg.connect({
    address: 'actor1',
    trigger: spy,
    observedTriggers: ['b'],
  })
  expect(msg.has('actor1')).toBeTrue()
  await wait(100)
  expect(spy.called).toBeFalse()
  close()
})
test('messenger: connect, close, send', async () => {
  const msg = useMessenger()
  const spy = sinon.spy()
  msg.connect({
    address: 'actor1',
    trigger: spy,
    observedTriggers: ['b'],
  })()
  await wait(100)
  msg({ address: 'actor1', event: { type: 'b', detail: { value: 4 } } })
  expect(spy.called).toBeFalse()
})
