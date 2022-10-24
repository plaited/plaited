/* eslint-disable compat/compat */
type CreateIDBCallback = (arg: IDBObjectStore) => void
export type IDB = (type: IDBTransactionMode, callback: CreateIDBCallback) => Promise<void>
export const createIDB = (dbName: string, storeName: string) => {
  const dbp = new Promise<IDBDatabase>((resolve, reject) => {
    const openreq = indexedDB.open(dbName)
    openreq.onerror = () => reject(openreq.error)
    openreq.onsuccess = () => resolve(openreq.result)
    // First time setup: create an empty object store
    openreq.onupgradeneeded = () => {
      !openreq.result.objectStoreNames.contains(storeName) &&
        openreq.result.createObjectStore(storeName)
    }
  })
  return (type: IDBTransactionMode, callback: CreateIDBCallback) =>
    dbp.then(
      (db: IDBDatabase) =>
        new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(storeName, type)
          transaction.oncomplete = () => resolve()
          // eslint-disable-next-line no-multi-assign
          transaction.onabort = transaction.onerror = () =>
            reject(transaction.error)
          callback(transaction.objectStore(storeName))
        })
    )
}
