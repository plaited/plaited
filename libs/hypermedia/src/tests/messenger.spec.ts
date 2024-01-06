import { test } from '@plaited/rite'
import sinon from 'sinon'
import { messenger } from '../messenger.js'

test('messenger: connect, send, close', async (t) => {
  const msg = messenger()
  const spy = sinon.spy()
  const close = msg.connect('actor1', spy)
  msg('actor1', { type: 'a', detail: { value: 4 } })
  await t.wait(60)
  t({
    given: 'message send',
    should: 'connected spy should receive message',
    actual: spy.calledWith({ type: 'a', detail: { value: 4 } }),
    expected: true,
  })
  close()
  t({
    given: 'close',
    should: 'has should return false',
    actual: msg.has('actor1'),
    expected: false,
  })
})
test('messenger: send, connect, close', async (t) => {
  const msg = messenger()
  const spy = sinon.spy()
  msg('actor1', { type: 'b', detail: { value: 4 } })
  const close = msg.connect('actor1', spy)
  t({
    given: 'connect',
    should: 'have actor1',
    actual: msg.has('actor1'),
    expected: true,
  })
  await t.wait(100)
  t({
    given: 'message send before connect',
    should: 'spy should not receive message',
    actual: spy.called,
    expected: false,
  })
  close()
})
test('messenger: connect, close, send', async (t) => {
  const msg = messenger()
  const spy = sinon.spy()
  msg.connect('actor1', spy)()
  await t.wait(100)
  msg('actor1', { type: 'b', detail: { value: 4 } })
  t({
    given: 'message send after close',
    should: 'spy should not receive message',
    actual: spy.called,
    expected: false,
  })
})
test('messenger: with worker', async (t) => {
  const msg = messenger()
  const worker = new Worker(new URL('/src/tests/__mocks__/test.worker.ts', import.meta.url), {
    type: 'module',
  })
  msg.connect('calculator', worker)

  const spy = sinon.spy()

  msg.connect('main', spy)

  msg('calculator', {
    type: 'calculate',
    detail: { a: 9, b: 10, operation: 'multiply' },
  })

  t({
    given: 'connect',
    should: 'have worker',
    actual: msg.has('calculator'),
    expected: true,
  })
  await t.wait(200)
  t({
    given: 'requesting calculate',
    should: 'update with value',
    actual: spy.calledWith({
      type: 'update',
      detail: 90,
    }),
    expected: true,
  })
})
