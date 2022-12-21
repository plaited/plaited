import { trueTypeOf } from '@plaited/utils'
import { createIDB, IDB } from './create-idb.js'

type UpdateStoreArg = (arg?: unknown) => unknown
export const useIndexedDB = async (
  key: string,
  initialValue?: unknown,
  idb?: IDB
): Promise<readonly [
  () => Promise<unknown>,
  (newValue: unknown | UpdateStoreArg) => Promise<void>
]> => {
  const db = idb || createIDB('USE_INDEXED_DB', 'STORE')
  initialValue &&
    (await (function setInitialValue() {
      return db('readwrite', store => {
        store.put(initialValue, key)
      })
    })())

  const updateStore = (newValue: UpdateStoreArg) =>
    db('readwrite', store => {
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

  const overwriteStore = (newValue: unknown) =>
    db('readwrite', store => store.put(newValue, key))

  const set = (newValue: unknown | UpdateStoreArg) =>
    trueTypeOf(newValue) === 'function'
      ? updateStore(newValue as UpdateStoreArg)
      : overwriteStore(newValue)

  const get = () => {
    let req: IDBRequest<unknown>
    return db('readonly', store => {
      req = store.get(key)
    }).then(() => req.result)
  }
  return Object.freeze<[
    () => Promise<unknown>,
    (newValue: unknown | UpdateStoreArg) => Promise<void>
      ]>([ get, set ])
}
