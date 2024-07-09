import { test, expect } from 'bun:test'
import { trueTypeOf } from '../true-type-of.js'

test('trueTypeOf()', () => {
  expect(trueTypeOf([])).toBe('array')
  expect(trueTypeOf({})).toBe('object')
  expect(trueTypeOf('')).toBe('string')
  expect(trueTypeOf(new Date())).toBe('date')
  expect(trueTypeOf(1)).toBe('number')
  expect(trueTypeOf(function () {})).toBe('function')
  expect(trueTypeOf(async function () {})).toBe('asyncfunction')
  expect(trueTypeOf(function* () {})).toBe('generatorfunction')
  expect(trueTypeOf(/test/i)).toBe('regexp')
  expect(trueTypeOf(RegExp('foo*'))).toBe('regexp')
  expect(trueTypeOf(true)).toBe('boolean')
  expect(trueTypeOf(null)).toBe('null')
  expect(trueTypeOf()).toBe('undefined')
  expect(trueTypeOf(new Set())).toBe('set')
  expect(trueTypeOf(new Map())).toBe('map')
  expect(trueTypeOf(Symbol('Thing'))).toBe('symbol')
})
