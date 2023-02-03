import { assertEquals, describe, it, sinon } from '../../test-deps.ts'
import { wait } from '../../utils/mod.ts'
import { messenger } from '../mod.ts'

describe('actor()', () => {
  it('connect, broadcast, close', async () => {
    const { send, connect } = messenger()
    const callback = sinon.spy()
    const close = connect('actor1', callback)
    send('actor1', { eventName: 'a', payload: 4 })
    await wait(100)
    assertEquals(
      callback.calledWith({ eventName: 'a', payload: 4 }),
      true,
      'sending message to connected actor should trigger callback',
    )
    close()
  })
  it('broadcast, connect, close', async () => {
    const { send, connect } = messenger()
    const callback = sinon.spy()
    send('actor1', { eventName: 'b', payload: 4 })
    const close = connect('actor1', callback)
    await wait(100)
    assertEquals(
      callback.notCalled,
      true,
      'sending a message to actor that is not connected should call not trigger callback',
    )
    close()
  })
})
