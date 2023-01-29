import test from 'ava'
import sinon from 'sinon'
import { debounce } from '../index.js'


let clock: sinon.SinonFakeTimers
test.beforeEach(function () {
  clock = sinon.useFakeTimers()
})

test.afterEach(function () {
  clock.restore()
})

test('debounces the fn', t => {
  const fn = sinon.spy()

  const debounced = debounce(fn, 100)
  debounced()

  t.truthy(fn.notCalled)
  clock.tick(50)

  t.truthy(fn.notCalled)
  clock.tick(100)

  t.truthy(fn.called)
  t.is(fn.getCalls().length, 1)
})

