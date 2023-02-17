import { assertEquals, sinon } from '../../test-deps.ts'
import { wait } from '../../utils/mod.ts'
import { messenger } from '../mod.ts'

Deno.test('actor: connect, broadcast, close', async () => {
  const { send, connect } = messenger()
  const callback = sinon.spy()
  const close = connect('actor1', callback)
  send('actor1', { type: 'a', data: 4 })
  await wait(100)
  assertEquals(
    callback.calledWith({ type: 'a', data: 4 }),
    true,
    'sending message to connected actor should trigger callback',
  )
  close()
})
Deno.test('actor: broadcast, connect, close', async () => {
  const { send, connect } = messenger()
  const callback = sinon.spy()
  send('actor1', { type: 'b', data: 4 })
  const close = connect('actor1', callback)
  await wait(100)
  assertEquals(
    callback.notCalled,
    true,
    'sending a message to actor that is not connected should call not trigger callback',
  )
  close()
})
