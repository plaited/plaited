/* eslint-disable @typescript-eslint/no-explicit-any */
import { noop } from '../utils/noop.js'

/**
 * Type definition for error catching utility function.
 * Handles both synchronous and asynchronous functions, capturing their errors.
 *
 * @template U Array of argument types
 * @template V Return type of tested function
 * @param fn Function to test for throws
 * @param args Arguments to pass to tested function
 * @returns Error message string if thrown, undefined if no error
 */
export type Throws = <U extends unknown[], V>(
  fn: (...args: U) => V,
  ...args: U
) => string | undefined | Promise<string | undefined>

const isPromise = (x: any) => x && typeof x.then === 'function'
const catchAndReturn = (x: Promise<unknown>) => x.catch((y) => y)
const catchPromise = (x: any) => (isPromise(x) ? catchAndReturn(x) : x)
/**
 * Utility function for testing if a function throws an error.
 * Supports both synchronous and Promise-returning functions.
 *
 * @template U Array of argument types
 * @template V Return type of tested function
 * @param fn Function to test (defaults to noop)
 * @param args Arguments to pass to tested function
 * @returns Error message if thrown, undefined if no error
 *
 * @example Synchronous Function
 * ```ts
 * // Test synchronous throw
 * const error = throws(() => {
 *   throw new Error('Test error');
 * });
 * assert(error === 'Error: Test error');
 *
 * // Test no throw
 * const noError = throws(() => {
 *   return 'success';
 * });
 * assert(noError === undefined);
 * ```
 *
 * @example Async Function
 * ```ts
 * // Test async throw
 * const asyncError = await throws(async () => {
 *   throw new Error('Async error');
 * });
 * assert(asyncError === 'Error: Async error');
 *
 * // Test no async throw
 * const noAsyncError = await throws(async () => {
 *   return 'success';
 * });
 * assert(noAsyncError === undefined);
 * ```
 *
 * @example With Arguments
 * ```ts
 * const divideBy = (a: number, b: number) => {
 *   if (b === 0) throw new Error('Division by zero');
 *   return a / b;
 * };
 *
 * const error = throws(divideBy, 10, 0);
 * assert(error === 'Error: Division by zero');
 * ```
 *
 * @remarks
 * - Handles both sync and async functions
 * - Returns undefined if no error thrown
 * - Converts errors to strings
 * - Supports variable arguments
 * - Safe for testing Promise rejections
 * - Defaults to testing noop function
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
