import {assert} from '@plaited/assert'
import {spy} from 'sinon'
import {connect, broadcast} from '../src'
import {wait} from '@plaited/utils'

describe('actor()', function() {
  it('connect, broadcast, close', async function() {
    const callback = spy()
    const close = connect('actor1', callback)
    broadcast('actor1', 4)
    await wait(100)
    assert({
      given: 'sending a message to actor',
      should: 'call trigger callback',
      actual: callback.calledWith(4),
      expected: true,
    })
    close()
  })
  it('broadcast, connect, close', async function() {
    const callback = spy()
    broadcast('actor1', 4)
    const close = connect('actor1', callback)
    await wait(100)
    assert({
      given: 'sending a message to actor that is not connected',
      should: 'call not trigger callback',
      actual: callback.notCalled,
      expected: true,
    })
    close()
  })
})
