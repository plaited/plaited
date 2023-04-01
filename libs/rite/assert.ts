import { deepEqual, wait } from '../utils/mod.ts'
import { throws } from './throws.ts'
import { match } from './match.ts'
import { findByAttribute } from './find-by-attribute.ts'
import { findByText } from './find-by-text.ts'
import { fireEvent } from './fire-event.ts'

export interface Assertion {
  <T extends unknown>(param: {
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

const requiredKeys = ['given', 'should', 'actual', 'expected']

export const assert: Assertion = (param) => {
  const args = param ?? {} as unknown as Parameters<Assertion>[0]
  const missing = requiredKeys.filter(
    (k) => !Object.keys(args).includes(k),
  )
  if (missing.length) {
    const msg = [
      `The following parameters are required by 'assert': (`,
      `  ${missing.join(', ')}`,
      ')',
    ].join('\n')
    throw new AssertionError(msg)
  }

  const {
    given = undefined,
    should = '',
    actual = undefined,
    expected = undefined,
  } = args
  if (!deepEqual(actual, expected)) {
    const message = `Given ${given}: should ${should}`
    console.error(
      '\x1b[31m',
      `--actual:${actual}`,
      '/n',
      '\x1b[32m',
      `++expected: ${expected}`,
    )
    throw new AssertionError(message)
  }
}

assert['match'] = match
assert['throws'] = throws
assert['wait'] = wait
assert['findByAttribute'] = findByAttribute
assert['findByText'] = findByText
assert['fireEvent'] = fireEvent

export const t = assert