import { assert, assertFalse } from '../../test-deps.ts'
import { deepEqual } from '../mod.ts'

const symbolKey = Symbol('symbolKey')
const originValue = {
  num: 0,
  str: '',
  boolean: true,
  unf: void 0,
  nul: null,
  obj: { name: 'object', id: 1 },
  arr: [0, 1, 2],
  func() {
    console.error('function')
  },
  date: new Date(0),
  reg: new RegExp('/regexp/ig'),
  [symbolKey]: 'symbol',
}

Deno.test('deepEqual()', () => {
  assert(deepEqual(originValue, { ...originValue }))
  assertFalse(deepEqual(originValue, {
    ...originValue,
    obj: {
      name: 'color',
    },
  }))
})
