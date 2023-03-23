import { assertEquals } from '../../dev-deps.ts'
import { generateId, setIdCounter, ueid } from '../mod.ts'

Deno.test('ueid: returns a string', () => {
  const output = ueid()
  assertEquals(typeof output, 'string')
})

Deno.test('ueid: should return unique ids', () => {
  const ids = new Array(5).fill(null).map(ueid)
  const uniqued = [...new Set(ids)]

  assertEquals(ids.length, 5)
  assertEquals(uniqued.length, 5)
})

Deno.test('ueid: supports an optional prefix', () => {
  assertEquals(ueid('a-').startsWith('a-'), true)
  assertEquals(ueid('b-').startsWith('b-'), true)
  assertEquals(ueid('c:').startsWith('c:'), true)
  assertEquals(ueid('word_').startsWith('word_'), true)
})

Deno.test('generateId: should return string with iterated count', () => {
  assertEquals(generateId(), '0')
  assertEquals(generateId(), '1')
})

Deno.test('generateId: should return prefixed string with iterated count', () => {
  assertEquals(generateId('pre-'), 'pre-2')
  assertEquals(generateId('pre-'), 'pre-3')
})

Deno.test('generateId: should return reset prefixed string with iterated count', () => {
  setIdCounter(0)
  assertEquals(generateId('pre-'), 'pre-0')
  assertEquals(generateId('pre-'), 'pre-1')
})
