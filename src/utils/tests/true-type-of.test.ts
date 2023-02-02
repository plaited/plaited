import { assertEquals } from '../../deps.ts'
import { trueTypeOf } from '../mod.ts'

Deno.test('trueTypeOf()', () => {
  assertEquals(trueTypeOf([]), 'array')
  assertEquals(trueTypeOf({}), 'object')
  assertEquals(trueTypeOf(''), 'string')
  assertEquals(trueTypeOf(new Date()), 'date')
  assertEquals(trueTypeOf(1), 'number')
  assertEquals(trueTypeOf(function () {}), 'function')
  assertEquals(trueTypeOf(function () {}), 'function')
  assertEquals(trueTypeOf(/test/i), 'regexp')
  assertEquals(trueTypeOf(RegExp('foo*')), 'regexp')
  assertEquals(trueTypeOf(true), 'boolean')
  assertEquals(trueTypeOf(null), 'null')
  assertEquals(trueTypeOf(), 'undefined')
  assertEquals(trueTypeOf(new Set()), 'set')
  assertEquals(trueTypeOf(new Map()), 'map')
  assertEquals(trueTypeOf(Symbol('Thing')), 'symbol')
})
