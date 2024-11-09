import type { Trigger } from '../behavioral/b-program.js'
import { type PlaitedTrigger, isPlaitedTrigger } from '../client/client.types.js'
import { PLAITED_INDEXED_DB, PLAITED_STORE } from '../client/client.constants.js'

type CreateIDBCallback = (arg: IDBObjectStore) => void
const createIDB = (dbName: string, storeName: string) => {
  const dbp = new Promise<IDBDatabase>((resolve, reject) => {
    const openreq = indexedDB.open(dbName)
    openreq.onerror = () => reject(openreq.error)
    openreq.onsuccess = () => resolve(openreq.result)
    // First time setup: create an empty object store
    openreq.onupgradeneeded = () => {
      !openreq.result.objectStoreNames.contains(storeName) && openreq.result.createObjectStore(storeName)
    }
  })
  return (type: IDBTransactionMode, callback: CreateIDBCallback) =>
    dbp.then(
      (db: IDBDatabase) =>
        new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(storeName, type)
          transaction.oncomplete = () => resolve()
          transaction.onabort = transaction.onerror = () => reject(transaction.error)
          callback(transaction.objectStore(storeName))
        }),
    )
}

// Async Pub Sub that allows us the get Last Value Cache and subscribe to changes and persist the value in indexedDB
export const getSyncHelpers = <T>({
  key,
  databaseName = PLAITED_INDEXED_DB,
  storeName = PLAITED_STORE,
  persist,
}: {
  /** key for stored value */
  key: string
  databaseName?: string
  storeName?: string
  persist?: boolean
}) => {
  const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
  const db = createIDB(databaseName, storeName)
  const write = (newValue: T) => db('readwrite', (store) => store.put(newValue, key))

  const onInitialize = async (initialValue?: T) => {
    if (initialValue !== undefined && !persist) {
      await write(initialValue)
    }
  }

  const get = () => {
    let req: IDBRequest<T>
    return db('readonly', (store) => {
      req = store.get(key)
    }).then(() => req.result)
  }

  const onUpdate = async (newValue: T) => {
    await write(newValue)
    const next = await get()
    channel.postMessage(next)
  }

  const onEffect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC: boolean) => {
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    const handler = (event: MessageEvent<T>) => trigger<T>({ type: eventType, detail: event.data })
    if (getLVC && !document.hasFocus()) {
      void get().then((value) => trigger<T>({ type: eventType, detail: value }))
    }
    channel.addEventListener('message', handler)
    const disconnect = () => channel.removeEventListener('message', handler)
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  return {
    onUpdate,
    onEffect,
    onInitialize,
  }
}
