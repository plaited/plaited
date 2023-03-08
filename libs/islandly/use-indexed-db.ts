import { trueTypeOf } from '../utils/mod.ts'
import { createIDB, IDB } from './create-idb.ts'

type UpdateStoreArg<T> = (arg?: T) => T
/** asynchronously get and set indexed db values */
export const useIndexedDB = async <T = unknown>(
  /** key for stored value */
  key: string,
  /** initial value can be null */
  initialValue?: T,
  /** you can actually pass it an reference to another indexedDB */
  idb?: IDB,
): Promise<
  readonly [
    () => Promise<T>,
    (newValue: T | UpdateStoreArg<T>) => Promise<void>,
  ]
> => {
  const db = idb || createIDB('USE_INDEXED_DB', 'STORE')
  initialValue &&
    (await (function setInitialValue() {
      return db('readwrite', (store) => {
        store.put(initialValue, key)
      })
    })())

  const updateStore = (newValue: UpdateStoreArg<T>) =>
    db('readwrite', (store) => {
      const req = store.openCursor(key)
      req.onsuccess = function getAndPutOnSuccess() {
        const cursor = this.result
        if (!cursor) {
          store.put(newValue(), key)
          return
        }
        const { value } = cursor
        cursor.update(newValue(value))
      }
    })

  const overwriteStore = (newValue: T) =>
    db('readwrite', (store) => store.put(newValue, key))

  const set = (newValue: T | UpdateStoreArg<T>) =>
    trueTypeOf(newValue) === 'function'
      ? updateStore(newValue as UpdateStoreArg<T>)
      : overwriteStore(newValue as T)

  const get = () => {
    let req: IDBRequest<T>
    return db('readonly', (store) => {
      req = store.get(key)
    }).then(() => req.result)
  }
  return Object.freeze([get, set])
}
