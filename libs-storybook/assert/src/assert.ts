import { deepEqual } from '@plaited/utils'

export interface Assertion {
  <T>(param: { given: string; should: string; actual: T; expected: T }): void
}

export class AssertionError extends Error {
  override name = 'AssertionError'
  constructor(message: string) {
    super(message)
  }
}

const requiredKeys = ['given', 'should', 'actual', 'expected']

export const assert: Assertion = (param) => {
  const args = param ?? ({} as unknown as Parameters<Assertion>[0])
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
