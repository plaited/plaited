import {
  afterEach,
  assert,
  assertEquals,
  beforeEach,
  describe,
  it,
  sinon,
} from '../../test-deps.ts'
import { debounce } from '../mod.ts'

describe('debounce', () => {
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

    assert(fn.notCalled)
    clock.tick(50)

    assert(fn.notCalled)
    clock.tick(100)

    assert(fn.called)
    assertEquals(fn.getCalls().length, 1)
  })
})