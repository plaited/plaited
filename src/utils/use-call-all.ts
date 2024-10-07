import { trueTypeOf } from './true-type-of.js'
/**
 * Calls all the given functions with the same arguments and returns nothing.
 * If a function is not actually a function, it is skipped.
 *
 * @param fns - The functions to call.
 * @returns Nothing.
 */
export const useCallAll =
  <F extends (...args: Parameters<F>) => ReturnType<F>>(...fns: F[]) =>
  (...args: Parameters<F>) => {
    for (const fn of fns) {
      if (trueTypeOf(fn) === 'function') fn(...args)
    }
  }
