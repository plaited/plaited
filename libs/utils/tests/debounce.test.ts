import { assertSpyCalls, FakeTime, spy } from '../../test-deps.ts'
import { debounce } from '../mod.ts'

Deno.test('debounces()', () => {
  const time = new FakeTime()
  try {
    const fn = spy()
    const debounced = debounce(fn, 100)
    debounced()

    assertSpyCalls(fn, 0)
    time.tick(50)
    assertSpyCalls(fn, 0)
    time.tick(100)
    assertSpyCalls(fn, 1)
  } finally {
    time.restore()
  }
})
