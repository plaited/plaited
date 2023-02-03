import { assertEquals } from '../../test-deps.ts'
import { keyMirror } from '../mod.ts'

Deno.test('keyMirror()', () => {
  assertEquals(keyMirror('a', 'b', 'c'), {
    a: 'a',
    b: 'b',
    c: 'c',
  }, 'return a object of mirrored string values')
})
