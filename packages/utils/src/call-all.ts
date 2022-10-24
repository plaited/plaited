import { trueTypeOf } from './true-type-of'

export const callAll = <F extends (...args: Parameters<F>) => ReturnType<F>>(...fns: F[]) => (...args: Parameters<F>
) => {
  return fns.forEach(fn => {
    if (trueTypeOf(fn) === 'function') fn(...args)
  })
}
