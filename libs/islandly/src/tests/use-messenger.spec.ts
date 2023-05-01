import { test } from '@plaited/rite'
import sinon from 'sinon'
import { useMessenger } from '../index.js'

test('useMessenger: connect, send, close', async t => {
  const [ connect, send ] = useMessenger()
  const spy = sinon.spy()
  const close = connect('actor1', spy)
  send('actor1', { type: 'a', detail: { value: 4 } })
  await t.wait(60)
  t({
    given: 'message send',
    should: 'connected spy should receive message',
    actual: spy.calledWith({ type: 'a', detail: { value: 4 } }),
    expected: true,
  })
  close()
})
test('useMessenger: send, connect, close', async t => {
  const [ connect, send ] = useMessenger()
  const spy = sinon.spy()
  send('actor1', { type: 'b', detail: { value: 4 } })
  const close = connect('actor1', spy)
  await t.wait(100)
  t({
    given: 'message send before connect',
    should: 'spy should not receive message',
    actual: spy.called,
    expected: false,
  })
  close()
})
test('useMessenger: connect, close, send', async t => {
  const [ connect, send ] = useMessenger()
  const spy = sinon.spy()
  connect('actor1', spy)()
  await t.wait(100)
  send('actor1', { type: 'b', detail: { value: 4 } })
  t({
    given: 'message send after close',
    should: 'spy should not receive message',
    actual: spy.called,
    expected: false,
  })
})
test('useMessenger: with worker', async t => {
  const [ connect, send ] = useMessenger()
  const worker = new Worker(new URL( '/src/tests/__mocks__/test.worker.ts', import.meta.url), {
    type: 'module',
  })
  connect.worker(
    'calculator',
    worker
  )

  const spy = sinon.spy()

  connect('main', spy)

  send('calculator', {
    type: 'calculate',
    detail: { a: 9, b: 10, operation: 'multiply' },
  })
  await t.wait(100)
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
