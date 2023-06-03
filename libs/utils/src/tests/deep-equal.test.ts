import { test, expect } from 'bun:test'
import { deepEqual } from '../index.js'

test('deepEqual()', () => {
  /** Primitive values */
  expect(deepEqual('string', 'string')).toBe(true)
  expect(deepEqual('string', 'different string')).toBe(false)
  expect(deepEqual(1, 1)).toBe(true)
  expect(deepEqual(1, 0o1)).toBe(true)
  expect(deepEqual(1, 0)).toBe(false)
  expect(deepEqual(/test/i, /test/i)).toBe(true)
  expect(deepEqual(/test/i, /test/)).toBe(false)
  expect(deepEqual(RegExp('foo*'), RegExp('foo*'))).toBe(true)
  expect(deepEqual(RegExp('foo*'), RegExp('foo*', 'g'))).toBe(false)

  /** handles falsey */
  expect(deepEqual(false, false)).toBe(true)
  expect(deepEqual(null, null)).toBe(true)
  expect(deepEqual(undefined, undefined)).toBe(true)
  expect(deepEqual(null, false)).toBe(false)
  expect(deepEqual(null, undefined)).toBe(false)
  expect(deepEqual(false, undefined)).toBe(false)

  /** Arrays */
  expect(deepEqual([ 'array' ], [ 'array' ])).toBe(true)
  expect(deepEqual([ 'array' ], [ 'nope' ])).toBe(false)

  /** Maps, sets and objects */
  expect(deepEqual(new Set([ 'set' ]), new Set([ 'set' ]))).toBe(true)
  expect(deepEqual(new Set([ 'set' ]), new Set([ 'nope' ]))).toBe(false)
  expect(deepEqual(new Map([ [ 'key', 'value' ] ]), new Map([ [ 'key', 'value' ] ])))
    .toBe(true)
  expect(
    deepEqual(new Map([ [ 'key', 'value' ] ]), new Map([ [ 'key', 'nope' ] ]))
  ).toBe(false)

  const func = () => {
    console.error('function')
  }
  const symbolKey = Symbol('symbolKey')

  const original = {
    num: 0,
    str: '',
    boolean: true,
    unf: void 0,
    nul: null,
    obj: { name: 'object', id: 1 },
    arr: [ 0, 1, 2 ],
    func,
    date: new Date(0),
    reg: new RegExp('/regexp/ig'),
    [symbolKey]: 'symbol',
  }

  const clone = {
    num: 0,
    str: '',
    boolean: true,
    unf: void 0,
    nul: null,
    obj: { name: 'object', id: 1 },
    arr: [ 0, 1, 2 ],
    func,
    date: new Date(0),
    reg: new RegExp('/regexp/ig'),
    [symbolKey]: 'symbol',
  }
  expect(deepEqual(original, clone)).toBe(true)
  expect(deepEqual(original, {
    ...clone,
    obj: {
      name: 'color',
    },
  })).toBe(false)
})
