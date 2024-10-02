import { deepEqual } from '../utils/deep-equal.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { AssertionError, MissingTestParamsError } from './errors.js'
import { PRIMITIVES } from './assert.constants.js'
import { trueTypeOf } from '../utils/true-type-of.js'

export type Assert = <T>(param: { given: string; should: string; actual: T; expected: T }) => void

const requiredKeys = ['given', 'should', 'actual', 'expected']

const replacer = (key: string | number | symbol, value: unknown) => {
  if (!key) return value
  return (
    isTypeOf<Record<string, unknown>>(value, 'object') || isTypeOf<unknown[]>(value, 'array') ? value
    : value instanceof Set ? `Set <${JSON.stringify(Array.from(value))}>`
    : value instanceof Map ? `Map <${JSON.stringify(Object.fromEntries(value))}>`
    : PRIMITIVES.has(trueTypeOf(value)) ? value
    : (value?.toString?.() ?? value)
  )
}

export const assert: Assert = (param) => {
  const args = param
  const missing = requiredKeys.filter((k) => !Object.keys(args).includes(k))
  if (missing.length) {
    const msg = [`The following parameters are required by 'assert': (`, `  ${missing.join(', ')}`, ')'].join('\n')
    throw new MissingTestParamsError(msg)
  }
  const { given = undefined, should = '', actual = undefined, expected = undefined } = args
  if (!deepEqual(actual, expected)) {
    const message = `Given ${given}: should ${should}`
    throw new AssertionError(JSON.stringify({ message, actual, expected }, replacer, 2))
  }
}
