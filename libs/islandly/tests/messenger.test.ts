import { assertSpyCall, assertSpyCalls, spy } from '../../test-deps.ts'
import { wait } from '../../utils/mod.ts'
import { messenger } from '../mod.ts'

Deno.test('actor: connect, broadcast, close', async () => {
  const { send, connect } = messenger()
  const callback = spy()
  const close = connect('actor1', callback)
  send('actor1', { type: 'a', data: 4 })
  await wait(100)
  assertSpyCall(callback, 0, { args: [{ type: 'a', data: 4 }] }), close()
})
Deno.test('actor: broadcast, connect, close', async () => {
  const { send, connect } = messenger()
  const callback = spy()
  send('actor1', { type: 'b', data: 4 })
  const close = connect('actor1', callback)
  await wait(100)
  assertSpyCalls(
    callback,
    0,
  )
  close()
})
