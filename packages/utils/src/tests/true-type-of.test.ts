/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable func-names */
import { trueTypeOf } from '../index.js'

test('trueTypeOf()', () => {
  expect(trueTypeOf([])).toBe('array')
  expect(trueTypeOf({})).toBe('object')
  expect(trueTypeOf('')).toBe('string')
  expect(trueTypeOf(new Date())).toBe('date')
  expect(trueTypeOf(1)).toBe('number')
  expect(trueTypeOf(function () {})).toBe('function')
  expect(trueTypeOf(async function () {})).toBe('asyncfunction')
  expect(trueTypeOf(/test/i)).toBe('regexp')
  expect(trueTypeOf(RegExp('foo*'))).toBe('regexp')
  expect(trueTypeOf(true)).toBe('boolean')
  expect(trueTypeOf(null)).toBe('null')
  expect(trueTypeOf()).toBe('undefined')
  expect(trueTypeOf(new Set())).toBe('set')
  expect(trueTypeOf(new Map())).toBe('map')
  expect(trueTypeOf(Symbol('Thing'))).toBe('symbol')
})
