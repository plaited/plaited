import { deepEqual, isTypeOf } from '@plaited/utils'
import { AssertionError } from './errors.js'

const requiredKeys = ['given', 'should', 'actual', 'expected']

export const assert = <T>(param: { given: string; should: string; actual: T; expected: T }) => {
  const args = param
  const missing = requiredKeys.filter((k) => !Object.keys(args).includes(k))
  if (missing.length) {
    const msg = [`The following parameters are required by 'assert': (`, `  ${missing.join(', ')}`, ')'].join('\n')
    throw new Error(msg)
  }

  const { given = undefined, should = '', actual = undefined, expected = undefined } = args
  if (!deepEqual(actual, expected)) {
    const message = `Given ${given}: should ${should}`
    const actualString =
      actual && typeof actual === 'object' && 'toString' in actual ? actual.toString()
      : isTypeOf<Record<string, unknown>>(actual, 'object') || isTypeOf<unknown[]>(actual, 'array') ?
        JSON.stringify(actual, null, 2)
      : actual
    const expectedString =
      expected && typeof expected === 'object' && 'toString' in expected ? expected.toString()
      : isTypeOf<Record<string, unknown>>(expected, 'object') || isTypeOf<unknown[]>(expected, 'array') ?
        JSON.stringify(expected, null, 2)
      : expected
    throw new AssertionError(JSON.stringify({ message, actual: actualString, expected: expectedString }, null, 2))
  }
}
