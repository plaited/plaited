import { deepEqual, isTypeOf } from '../utils.js'
import { AssertionError, MissingTestParamsError } from './errors.js'

export type Assert = <T>(param: { given: string; should: string; actual: T; expected: T }) => void

const requiredKeys = ['given', 'should', 'actual', 'expected']

const replacer = (_: string | number | symbol, value: unknown) =>
  value && typeof value === 'object' && 'toString' in value ? value.toString()
  : isTypeOf<Record<string, unknown>>(value, 'object') || isTypeOf<unknown[]>(value, 'array') ?
    JSON.stringify(value, replacer, 2)
  : `${value}`

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
