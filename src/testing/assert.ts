import { deepEqual } from '../utils/deep-equal.js'
import { trueTypeOf } from '../utils/true-type-of.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { AssertionError, MissingTestParamsError } from './errors.js'
/**
 * Type definition for assertion function with detailed error reporting.
 * Provides structured comparison with descriptive error messages.
 *
 * @template T Type of values being compared
 * @param param Assertion configuration object
 * @param param.given Context description
 * @param param.should Expected behavior description
 * @param param.actual Actual value
 * @param param.expected Expected value
 */
export type Assert = <T>(param: { given: string; should: string; actual: T; expected: T }) => void

const PRIMITIVES = new Set(['null', 'undefined', 'number', 'string', 'boolean', 'bigint'])

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
/**
 * Performs deep equality assertion with detailed error reporting.
 * Supports complex objects, primitive types, and built-in collections.
 *
 * @template T Type of values being compared
 * @throws {MissingTestParamsError} When required parameters are missing
 * @throws {AssertionError} When assertion fails
 *
 * @example Basic Assertion
 * ```ts
 * assert({
 *   given: 'a number calculation',
 *   should: 'return the sum',
 *   actual: add(2, 2),
 *   expected: 4
 * });
 * ```
 *
 * @example Complex Objects
 * ```ts
 * assert({
 *   given: 'user object',
 *   should: 'match expected structure',
 *   actual: getUser(1),
 *   expected: {
 *     id: 1,
 *     name: 'John',
 *     roles: new Set(['admin'])
 *   }
 * });
 * ```
 *
 * @example Collections
 * ```ts
 * assert({
 *   given: 'a Map of configurations',
 *   should: 'contain expected entries',
 *   actual: getConfig(),
 *   expected: new Map([
 *     ['key1', 'value1'],
 *     ['key2', 'value2']
 *   ])
 * });
 * ```
 *
 * Features:
 * - Deep equality comparison
 * - Detailed error messages
 * - Support for Sets and Maps
 * - Custom stringification
 * - Type safety
 *
 * @remarks
 * - All parameters are required
 * - Performs deep equality check
 * - Special handling for Sets and Maps
 * - Custom JSON stringification
 * - Maintains type information
 *
 * Error Message Format:
 * ```json
 * {
 *   "message": "Given [context]: should [expectation]",
 *   "actual": [actual value],
 *   "expected": [expected value]
 * }
 * ```
 */
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
