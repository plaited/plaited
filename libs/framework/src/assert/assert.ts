import type { AssertionErrorInterface } from './types.js'
import { deepEqual } from '../utils.js'
import { ASSERTION_ERROR_NAME } from './constants.js'

export class AssertionError extends Error implements AssertionErrorInterface {
  override name = ASSERTION_ERROR_NAME
  constructor(message: string) {
    super(message)
  }
}

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
    throw new AssertionError(JSON.stringify({ message, actual, expected }))
  }
}
