import { assertSpyCall, spy } from '../../test-deps.ts'
import { callAll } from '../mod.ts'

Deno.test('callAll()', () => {
  const expected = 'string'
  const firstSpy = spy()
  const secondSpy = spy()
  callAll(firstSpy, secondSpy)(expected)
  assertSpyCall(firstSpy, 0, { args: [expected] })
  assertSpyCall(secondSpy, 0, { args: [expected] })
})
