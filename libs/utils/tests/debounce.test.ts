import { assert, assertEquals, sinon } from '../../test-deps.ts'
import { debounce } from '../mod.ts'

Deno.test('debounces()', () => {
  const clock = sinon.useFakeTimers()
  const fn = sinon.spy()

  const debounced = debounce(fn, 100)
  debounced()

  assert(fn.notCalled)
  clock.tick(50)

  assert(fn.notCalled)
  clock.tick(100)

  assert(fn.called)
  assertEquals(fn.getCalls().length, 1)
  clock.restore()
})
