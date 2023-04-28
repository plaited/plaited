import { noop } from '@plaited/utils'
// deno-lint-ignore no-explicit-any
const isPromise = (x: any) => x && typeof x.then === 'function'
const catchAndReturn = (x: Promise<unknown>) => x.catch(y => y)
// deno-lint-ignore no-explicit-any
const catchPromise = (x: any) => (isPromise(x) ? catchAndReturn(x) : x)

type Throws = <U extends unknown[], V>(
  fn: (...args: U) => V,
  ...args: U
) => unknown | Promise<unknown>

export const throws: Throws = (
  //@ts-ignore: noop
  fn = noop,
  ...args
) => {
  try {
    return catchPromise(fn(...args))
  } catch (err) {
    return err.toString()
  }
}
