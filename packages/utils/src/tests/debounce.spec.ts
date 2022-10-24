import { assert } from '@esm-bundle/chai'
import sinon from 'sinon'
import { debounce } from '..'

describe('debounce()', () => {
  let clock: sinon.SinonFakeTimers
  beforeEach(function () {
    clock = sinon.useFakeTimers()
  })

  afterEach(function () {
    clock.restore()
  })

  it('debounces the fn', () => {
    const fn = sinon.spy()

    const debounced = debounce(fn, 100)
    debounced()

    assert.isOk(fn.notCalled)
    clock.tick(50)

    assert.isOk(fn.notCalled)
    clock.tick(100)

    assert.isOk(fn.called)
    assert.equal(fn.getCalls().length, 1)
  })
})
