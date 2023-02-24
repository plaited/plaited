import { trueTypeOf } from './true-type-of.ts'

/** Call all function passed in with the same arguments when invoked */
export const callAll =
  <F extends (...args: Parameters<F>) => ReturnType<F>>(...fns: F[]) =>
  (...args: Parameters<F>) => {
    return fns.forEach((fn) => {
      if (trueTypeOf(fn) === 'function') fn(...args)
    })
  }
