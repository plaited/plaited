import {assert} from '@esm-bundle/chai'
import {wait} from '../../utils'
import {spy} from 'sinon'
import {messenger} from '..'

describe('actor()', () => {
  it('connect, broadcast, close', async () => {
    const {send, connect} = messenger()
    const callback = spy()
    const close = connect('actor1', callback)
    send('actor1', 4)
    await wait(100)
    assert.equal(callback.calledWith(4), true, 'sending message to connected actor should trigger callback')
    close()
  })
  it('broadcast, connect, close', async () => {
    const {send, connect} = messenger()
    const callback = spy()
    send('actor1', 4)
    const close = connect('actor1', callback)
    await wait(100)
    assert.equal(
      callback.notCalled,
      true,
      'sending a message to actor that is not connected should call not trigger callback',
    )
    close()
  })
})
