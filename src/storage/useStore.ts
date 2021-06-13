import {trueTypeOf} from '../utils'
interface Callback<T> {
  (arg: T): T
}
export const useStore = <T>(initialStore:T) => {
  let store = initialStore
  const get = () => store
  const set = (newStore:T | Callback<T>) => {
    store = trueTypeOf(newStore) === 'function' ? (newStore as Callback<T>)(store) : newStore as T
  }
  return Object.freeze([get, set])
}
