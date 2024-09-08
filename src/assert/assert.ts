import { deepEqual } from './deep-equal.js'
import { isTypeOf } from '../utils/true-type-of.js'
import { AssertionError, MissingTestParamsError } from './errors.js'
import { useSend } from '../client/use-handler.js'
import { PLAITED_TEST_HANDLER } from '../shared/constants.js'

type Assert = <T>(param: { given: string; should: string; actual: T; expected: T }) => void

const requiredKeys = ['given', 'should', 'actual', 'expected']

const replacer = (_: string| number | symbol, value: unknown) => value && typeof value === 'object' && 'toString' in value
  ? value.toString()
  : isTypeOf<Record<string, unknown>>(value, 'object') || isTypeOf<unknown[]>(value, 'array')
  ? JSON.stringify(value, replacer, 2)
  : `${value}`

export const unsafeAssert:Assert = (param) => {
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

export const assert:Assert = (param) => {
  try {
    unsafeAssert(param)
  } catch (error) {
    if(error instanceof AssertionError || error instanceof MissingTestParamsError) {
      const send = useSend(PLAITED_TEST_HANDLER)
      send({ type: error.name, detail: {
        location: window?.location.href,
        message: error.message,
      }})
    }
  }
}

