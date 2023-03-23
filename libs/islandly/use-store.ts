import { trueTypeOf } from '../utils/mod.ts'

/**
 * @description
 * a simple utility function for safely getting and setting values you need to persist during run.
 *
 * @example
 *  const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
 *  setStore((prev) => {
 *    if (typeof prev !== 'number') return { ...prev, b: 2 }
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
      ? (newStore as ((arg: T) => T))(store)
      : newStore as T
  }
  return Object.freeze<[() => T, (newStore: T | ((arg: T) => T)) => void]>([
    get,
    set,
  ])
}
