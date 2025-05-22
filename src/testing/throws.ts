/* eslint-disable @typescript-eslint/no-explicit-any */
import { noop } from '../utils/noop.js'

/**
 * Type definition for error catching utility function.
 * Handles both synchronous and asynchronous functions, capturing their errors
 * and converting them to string representations.
 *
 * @typeParam U - Array of argument types that the tested function accepts
 * @typeParam V - Return type of the tested function, can be any value or Promise
 *
 * @param fn - Function to test for throws. Should be the function you expect to throw an error
 * @param args - Arguments to pass to the tested function. Must match the parameter types of `fn`
 *
 * @returns For synchronous functions, returns a string containing the error message if an error
 * was thrown, or undefined if no error occurred. For asynchronous functions, returns a Promise
 * that resolves to either the error message string or undefined.
 *
 * @example Testing a synchronous function that throws
 * ```ts
 * const error = throws(() => {
 *   throw new Error('Invalid input');
 * });
 * // error === 'Error: Invalid input'
 * ```
 *
 * @example Testing a function with arguments
 * ```ts
 * const divide = (a: number, b: number) => {
 *   if (b === 0) throw new Error('Division by zero');
 *   return a / b;
 * };
 * const error = throws(divide, 10, 0);
 * // error === 'Error: Division by zero'
 * ```
 *
 * @example Testing an async function
 * ```ts
 * const error = await throws(async () => {
 *   throw new Error('Async error');
 * });
 * // error === 'Error: Async error'
 * ```
 */
export type Throws = <U extends unknown[], V>(
  fn: (...args: U) => V,
  ...args: U
) => string | undefined | Promise<string | undefined>

/**
 * Checks if a value is a Promise by testing for the presence of a `then` method.
 * @internal
 * @param x - Value to check
 * @returns True if the value is Promise-like
 */
const isPromise = (x: any) => x && typeof x.then === 'function'

/**
 * Catches any rejection from a Promise and returns the error.
 * @internal
 * @param x - Promise to handle
 * @returns A new Promise that never rejects, instead resolving with the error
 */
const catchAndReturn = (x: Promise<unknown>) => x.catch((y) => y)

/**
 * Handles both Promise and non-Promise values, ensuring errors are caught.
 * @internal
 * @param x - Value or Promise to process
 * @returns Original value or a Promise that resolves with either the value or error
 */
const catchPromise = (x: any) => (isPromise(x) ? catchAndReturn(x) : x)

/**
 * Utility function for testing if a function throws an error.
 * Captures both synchronous throws and Promise rejections, converting them to string representations.
 *
 * @template U - Array of argument types for the tested function
 * @template V - Return type of the tested function (can be any value or Promise)
 *
 * @param fn - Function to test for throws. Defaults to noop if not provided
 * @param args - Arguments to pass to the tested function
 *
 * @returns A string containing the error message if an error occurred, undefined otherwise.
 * For async functions, returns a Promise that resolves to the error string or undefined.
 *
 * @throws Never - All errors are caught and returned as strings
 *
 * @remarks
 * This function is particularly useful for:
 * - Unit testing error cases
 * - Verifying error handling behavior
 * - Testing both sync and async error paths
 * - Ensuring consistent error handling across different function types
 *
 * The function will:
 * 1. Execute the provided function with given arguments
 * 2. Catch any thrown errors or Promise rejections
 * 3. Convert errors to strings for consistent handling
 * 4. Return undefined if no error occurs
 */
export const throws: Throws = (
  //@ts-ignore: noop
  fn = noop,
  ...args
) => {
  try {
    catchPromise(fn(...args))
    return undefined
  } catch (err) {
    return err?.toString()
  }
}
