import { assert, assertFalse } from '../../test-deps.ts'
import { deepEqual } from '../mod.ts'

Deno.test('deepEqual()', () => {
  /** Primitive values */
  assert(deepEqual('string', 'string'))
  assertFalse(deepEqual('string', 'different string'))
  assert(deepEqual(1, 1))
  assert(deepEqual(1, 0o1))
  assertFalse(deepEqual(1, 0))
  assert(deepEqual(/test/i, /test/i))
  assertFalse(deepEqual(/test/i, /test/))
  assert(deepEqual(RegExp('foo*'), RegExp('foo*')))
  assertFalse(deepEqual(RegExp('foo*'), RegExp('foo*', 'g')))

  /** handles falsey */
  assert(deepEqual(false, false))
  assert(deepEqual(null, null))
  assert(deepEqual(undefined, undefined))
  assertFalse(deepEqual(null, false))
  assertFalse(deepEqual(null, undefined))
  assertFalse(deepEqual(false, undefined))

  /** Arrays */
  assert(deepEqual(['array'], ['array']))
  assertFalse(deepEqual(['array'], ['nope']))

  /** Maps, sets and objects */
  assert(deepEqual(new Set(['set']), new Set(['set'])))
  assertFalse(deepEqual(new Set(['set']), new Set(['nope'])))
  assert(deepEqual(new Map([['key', 'value']]), new Map([['key', 'value']])))
  assertFalse(
    deepEqual(new Map([['key', 'value']]), new Map([['key', 'nope']])),
  )

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
    arr: [0, 1, 2],
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
    arr: [0, 1, 2],
    func,
    date: new Date(0),
    reg: new RegExp('/regexp/ig'),
    [symbolKey]: 'symbol',
  }
  assert(deepEqual(original, clone))
  assertFalse(deepEqual(original, {
    ...clone,
    obj: {
      name: 'color',
    },
  }))
})
