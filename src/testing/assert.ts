import { deepEqual } from '../utils/deep-equal.js'
import { trueTypeOf } from '../utils/true-type-of.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { AssertionError, MissingTestParamsError } from './errors.js'

/**
 * Parameters for the assertion function
 * @template T - The type of values being compared
 */
type AssertParams<T> = {
  given: string
  should: string
  actual: T
  expected: T
}

/**
 * Type definition for assertion function that provides structured comparison with detailed error reporting.
 * @template T - Type parameter representing the values being compared
 */
export type Assert = <T>(param: AssertParams<T>) => void

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
 * A powerful assertion function for testing with detailed error reporting and type safety.
 * This function compares values and throws detailed errors when assertions fail.
 *
 * @template T - Type of values being compared. Must be the same type for both actual and expected values
 *
 * @param param - Configuration object for the assertion
 * @param param.given - Description of the test context or scenario (e.g., "a user login attempt")
 * @param param.should - Expected behavior written in present tense (e.g., "return true for valid credentials")
 * @param param.actual - The value or result being tested
 * @param param.expected - The expected value or result to compare against
 *
 * @throws {MissingTestParamsError} When any required parameter (given, should, actual, expected) is missing
 * @throws {AssertionError} When the assertion fails, providing a detailed comparison of actual vs expected values
 *
 * @example
 * Simple Value Comparison
 * ```ts
 * assert({
 *   given: 'a number multiplication',
 *   should: 'return the correct product',
 *   actual: 2 * 3,
 *   expected: 6
 * });
 * ```
 *
 * @example
 * Object Comparison
 * ```ts
 * assert({
 *   given: 'a user object',
 *   should: 'have the correct properties',
 *   actual: {
 *     name: 'John',
 *     age: 30,
 *     roles: ['admin', 'user']
 *   },
 *   expected: {
 *     name: 'John',
 *     age: 30,
 *     roles: ['admin', 'user']
 *   }
 * });
 * ```
 *
 * @example
 * Collections Comparison
 * ```ts
 * assert({
 *   given: 'a Set of unique values',
 *   should: 'contain all expected elements',
 *   actual: new Set([1, 2, 3]),
 *   expected: new Set([1, 2, 3])
 * });
 *
 * assert({
 *   given: 'a Map of configurations',
 *   should: 'match the expected key-value pairs',
 *   actual: new Map([['debug', true], ['mode', 'production']]),
 *   expected: new Map([['debug', true], ['mode', 'production']])
 * });
 * ```
 *
 * @remarks
 * Usage Guidelines:
 * 1. Always provide clear, descriptive contexts in the 'given' parameter
 * 2. Write 'should' statements that clearly describe the expected behavior
 * 3. Ensure actual and expected values are of the same type
 * 4. Use for both simple and complex value comparisons
 * 5. Review error messages carefully for debugging
 *
 * Features:
 * - TypeScript type safety
 * - Deep equality comparison
 * - Built-in support for Set and Map collections
 * - Detailed error messages with formatted output
 * - Primitive and complex object handling
 *
 * Error Message Format:
 * ```
 * {
 *   "message": "Given [context]: should [behavior]",
 *   "actual": [formatted actual value],
 *   "expected": [formatted expected value]
 * }
 * ```
 */

/**
 * Main assertion function for testing with detailed error reporting.
 * @see {Assert} for type definition and examples
 * @internal
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
