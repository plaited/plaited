import { trueTypeOf } from '@plaited/utils'
export const useStore = <T>(initialStore: T) => {
  let store = initialStore
  const get = () => store
  const set = (newStore: T | ((arg: T) => T)) => {
    store = trueTypeOf(newStore) === 'function' ? (newStore as ((arg: T) => T))(store) : newStore as T
  }
  return Object.freeze<[() => T, (newStore: T | ((arg: T) => T)) => void]>([ get, set ])
}
