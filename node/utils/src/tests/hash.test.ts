import { assertEquals } from '../../dev-deps.ts'
import { hashString } from '../mod.ts'

Deno.test('hashString()', () => {
  assertEquals(hashString('test'), 2090756197, 'Given a string, return a hash')
  assertEquals(hashString(''), null, 'Given a damn empty string, return null')
})
