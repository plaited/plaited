import { PLAITED_INDEXED_DB } from '../client/client.constants.js'

type CreateIDBCallback = (arg: IDBObjectStore) => void

export const createIDB = <T>(
  storeName: string,
  databaseName = PLAITED_INDEXED_DB,
): {
  delete: (key: string) => Promise<void>
  get: (key: string) => Promise<T>
  set: (key: string, value: T) => Promise<void>
} => {
  const db = async (type: IDBTransactionMode, callback: CreateIDBCallback) => {
    const dbp = await new Promise<IDBDatabase>((resolve, reject) => {
      const openreq = indexedDB.open(databaseName)
      openreq.onerror = () => reject(openreq.error)
      openreq.onsuccess = () => resolve(openreq.result)
      // First time setup: create an empty object store
      openreq.onupgradeneeded = () => {
        !openreq.result.objectStoreNames.contains(storeName) && openreq.result.createObjectStore(storeName)
      }
    })
    return new Promise<void>((resolve, reject) => {
      const transaction = dbp.transaction(storeName, type)
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () => reject(transaction.error)
      callback(transaction.objectStore(storeName))
    })
  }
  return {
    delete: (key: string) => db('readwrite', (store) => store.delete(key)),
    get: (key: string) => {
      let req: IDBRequest<T>
      return db('readonly', (store) => {
        req = store.get(key)
      }).then(() => req.result)
    },
    set: (key: string, value: T) => db('readwrite', (store) => store.put(value, key)),
  }
}
