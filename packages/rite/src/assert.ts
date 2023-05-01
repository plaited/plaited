import { deepEqual, wait } from '@plaited/utils'
import { throws } from './throws.js'
import { match } from './match.js'
import { findByAttribute } from './find-by-attribute.js'
import { findByText } from './find-by-text.js'
import { fireEvent } from './fire-event.js'

export interface Assertion {
  <T>(param: {
    given: string
    should: string
    actual: T
    expected: T
  }): void
  findByAttribute: typeof findByAttribute
  findByText: typeof findByText
  fireEvent: typeof fireEvent
  match: typeof match
  throws: typeof throws
  wait: typeof wait
}

export class AssertionError extends Error {
  override name = 'AssertionError'
  constructor(message: string) {
    super(message)
  }
}

const requiredKeys = [ 'given', 'should', 'actual', 'expected' ]

export const assert: Assertion = param => {
  const args = param ?? {} as unknown as Parameters<Assertion>[0]
  const missing = requiredKeys.filter(
    k => !Object.keys(args).includes(k)
  )
  if (missing.length) {
    const msg = [
      `The following parameters are required by 'assert': (`,
      `  ${missing.join(', ')}`,
      ')',
    ].join('\n')
    throw new Error(msg)
  }

  const {
    given = undefined,
    should = '',
    actual = undefined,
    expected = undefined,
  } = args
  if (!deepEqual(actual, expected)) {
    const message = `Given ${given}: should ${should}`
    throw new AssertionError(JSON.stringify({ message, actual, expected }))
  }
}

assert['match'] = match
assert['throws'] = throws
assert['wait'] = wait
assert['findByAttribute'] = findByAttribute
assert['findByText'] = findByText
assert['fireEvent'] = fireEvent

export const t = assert
