import { Trigger } from '../behavioral/types.js'
import { SubscribeToPublisher } from './use-publisher.js'
import { PLAITED_INDEXED_DB, PLAITED_STORE } from './constants.js'

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

export type PubIndexedDB<T> = ReturnType<typeof usePublisherDB<T>>

export function usePublisherDB<T>(
  key: string,
  initialValue?: never,
  option?: {
    databaseName: string
    storeName: string
  },
): Promise<{
  (newValue: T): Promise<void>
  sub: SubscribeToPublisher
  get: () => Promise<T | undefined>
}>
export function usePublisherDB<T>(
  key: string,
  initialValue: T,
  option?: {
    databaseName: string
    storeName: string
  },
): Promise<{
  (newValue: T): Promise<void>
  sub: SubscribeToPublisher
  get: () => Promise<T>
}>
// Async Pub Sub that allows us the get Last Value Cache and subscribe to changes and persist the value in indexedDB
export async function usePublisherDB<T>(
  /** key for stored value */
  key: string,
  /** initial value can be undefined */
  initialValue: T,
  /** you can actually pass it an reference to another indexedDB */
  option?: {
    databaseName: string
    storeName: string
  },
) {
  const databaseName = option?.databaseName ?? PLAITED_INDEXED_DB
  const storeName = option?.storeName ?? PLAITED_STORE
  const db = createIDB(databaseName, storeName)
  const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)

  const updateStore = (newValue: T) => db('readwrite', (store) => store.put(newValue, key))

  // If initial value provided update store
  initialValue !== undefined && (await updateStore(initialValue))

  const get = () => {
    let req: IDBRequest<T>
    return db('readonly', (store) => {
      req = store.get(key)
    }).then(() => req.result)
  }

  const pub = async (newValue: T) => {
    await updateStore(newValue)
    const next = await get()
    channel.postMessage(next)
  }

  pub.sub = (eventType: string, trigger: Trigger, getLVC = false) => {
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    const handler = (event: MessageEvent<T>) => trigger<T>({ type: eventType, detail: event.data })
    getLVC && void get().then((value) => trigger<T>({ type: eventType, detail: value }))
    channel.addEventListener('message', handler)
    return () => channel.removeEventListener('message', handler)
  }
  pub.get = get
  return pub
}
