/* eslint-disable @typescript-eslint/no-explicit-any */
import { noop } from '@plaited/utils'
const isPromise = (x: any) => x && typeof x.then === 'function'
const catchAndReturn = (x: Promise<unknown>) => x.catch((y) => y)
const catchPromise = (x: any) => (isPromise(x) ? catchAndReturn(x) : x)

type Throws = <U extends unknown[], V>(fn: (...args: U) => V, ...args: U) => unknown | Promise<unknown>

export const throws: Throws = (
  //@ts-ignore: noop
  fn = noop,
  ...args
) => {
  try {
    catchPromise(fn(...args))
    return undefined
  } catch (err) {
    return err.toString()
  }
}
