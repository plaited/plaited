import { assert, sinon } from '../../test-deps.ts'
import { callAll } from '../mod.ts'

Deno.test('callAll()', () => {
  const expected = 'string'
  const firstSpy = sinon.spy()
  const secondSpy = sinon.spy()
  callAll(firstSpy, secondSpy)(expected)
  assert(firstSpy.calledWith(expected))
  assert(secondSpy.calledWith(expected))
})