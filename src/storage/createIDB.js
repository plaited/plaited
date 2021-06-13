/* eslint-disable compat/compat */
/**
 * 
 * @param {string} dbName 
 * @param {string} storeName 
 */
export const createIDB = (dbName, storeName) => {
  const dbp = new Promise((resolve, reject) => {
    const openreq = indexedDB.open(dbName)
    openreq.onerror = () => reject(openreq.error)
    openreq.onsuccess = () => resolve(openreq.result)
    // First time setup: create an empty object store
    openreq.onupgradeneeded = () => {
      !openreq.result.objectStoreNames.contains(storeName) &&
        openreq.result.createObjectStore(storeName)
    }
  })
  return (type, callback) =>
    dbp.then(
      db =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(storeName, type)
          transaction.oncomplete = () => resolve()
          // eslint-disable-next-line no-multi-assign
          transaction.onabort = transaction.onerror = () =>
            reject(transaction.error)
          callback(transaction.objectStore(storeName))
        }),
    )
}
