import { trueTypeOf, publisher } from '@plaited/utils'
/**
 * @description
 * A simple utility function for safely getting and setting values you need to persist during run.
 * When using the callback feature userStore passes a structured clone of the currently stored value
 * as a parameter. If you pass a function as nestStore, it will be treated as an updater function.
 * It must be pure, should take the previous store value as its only argument,
 * and should return the next store.
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

export const useStore = <T>(
  initialStore?: T,
): readonly [
  {
    (): T | undefined
    subscribe(cb: (arg: T) => void): () => boolean
  },
  (newStore: T | ((arg: T) => T)) => T,
] => {
  let store = initialStore
  let pub: ReturnType<typeof publisher<T>>
  /** Get the store value */
  const get = () => store
  /**
   * Subscribes to changes in the store.
   *
   * @param cb - A callback function to be called when the store changes.
   * @returns A function to unsubscribe from the store.
   */
  get.subscribe = (cb: (arg: T) => void) => {
    pub = pub ?? publisher<T>()
    return pub.subscribe(cb)
  }
  /**
   * Updates the store with a new value and returns the updated value.
   *
   * @param newStore - The new value for the store, or a function that takes the current value of the store and returns a new value.
   * @returns The updated value of the store.
   */
  const set = (newStore: T | ((arg: T) => T)) => {
    store =
      trueTypeOf(newStore) === 'function' ? (newStore as (arg: T) => T)(structuredClone(store as T)) : (newStore as T)
    pub && pub(store)
    return store
  }

  return Object.freeze([get, set])
}
