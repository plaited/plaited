import { assertSpyCall, assertSpyCalls, spy } from '../../dev-deps.ts'
import { wait } from '../../utils/mod.ts'
import { messenger } from '../mod.ts'

Deno.test('messenger: connect, broadcast, close', async () => {
  const { send, connect } = messenger()
  const callback = spy()
  const close = connect('actor1', callback)
  send('actor1', { type: 'a', detail: { value: 4 } })
  await wait(60)
  assertSpyCall(callback, 0, { args: [{ type: 'a', detail: { value: 4 } }] }),
    close()
})
Deno.test('messenger: broadcast, connect, close', async () => {
  const { send, connect } = messenger()
  const callback = spy()
  send('actor1', { type: 'b', detail: { value: 4 } })
  const close = connect('actor1', callback)
  await wait(60)
  assertSpyCalls(
    callback,
    0,
  )
  close()
})
