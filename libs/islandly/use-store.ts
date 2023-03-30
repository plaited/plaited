import { trueTypeOf } from '../utils/mod.ts'

/**
 * @description
 * a simple utility function for safely getting and setting values you need to persist during run.
 * When using the callback feature userStore passes a structured clone of the currently stored value
 * as a parameter.
 *
 * @example
 *  const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
 *  setStore((prev) => {
 *    if (typeof prev !== 'number') prev.b = 2
 *    return prev
 *  })
 *  store() //=> { a: 1, b: 2 }
 *  setStore(3)
 *  store() // => 3
 */

export const useStore = <T>(initialStore: T) => {
  let store = initialStore
  const get = () => store
  const set = (newStore: T | ((arg: T) => T)) => {
    store = trueTypeOf(newStore) === 'function'
      ? (newStore as ((arg: T) => T))(structuredClone(store))
      : newStore as T
  }
  return Object.freeze<[() => T, (newStore: T | ((arg: T) => T)) => void]>([
    get,
    set,
  ])
}
