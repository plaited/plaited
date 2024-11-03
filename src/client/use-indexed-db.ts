import type { Trigger } from '../behavioral/b-program.js'
import { type PlaitedTrigger, type Effect, isPlaitedTrigger } from '../client/client.types.js'
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

export function useIndexedDB<T>(
  key: string,
  initialValue?: never,
  options?: {
    databaseName: string
    storeName: string
  },
): Promise<{
  (newValue: T): Promise<void>
  effect: Effect
  get: () => Promise<T | undefined>
}>
export function useIndexedDB<T>(
  key: string,
  initialValue: T,
  option?: {
    databaseName: string
    storeName: string
  },
): Promise<{
  (newValue: T): Promise<void>
  effect: Effect
  get: () => Promise<T>
}>
// Async Pub Sub that allows us the get Last Value Cache and subscribe to changes and persist the value in indexedDB
export async function useIndexedDB<T>(
  /** key for stored value */
  key: string,
  /** initial value can be undefined */
  initialValue: T,
  /** you can actually pass it an reference to another indexedDB */
  options?: {
    databaseName?: string
    storeName?: string
    useCachedValue?: boolean
  },
) {
  const databaseName = options?.databaseName ?? PLAITED_INDEXED_DB
  const storeName = options?.storeName ?? PLAITED_STORE
  const db = createIDB(databaseName, storeName)
  const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)

  const write = (newValue: T) => db('readwrite', (store) => store.put(newValue, key))

  if (initialValue !== undefined && !options?.useCachedValue) {
    await write(initialValue)
  }

  const get = () => {
    let req: IDBRequest<T>
    return db('readonly', (store) => {
      req = store.get(key)
    }).then(() => req.result)
  }

  const set = async (newValue: T) => {
    await write(newValue)
    const next = await get()
    channel.postMessage(next)
  }

  const effect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    const handler = (event: MessageEvent<T>) => trigger<T>({ type: eventType, detail: event.data })
    getLVC && void get().then((value) => trigger<T>({ type: eventType, detail: value }))
    channel.addEventListener('message', handler)
    const disconnect = () => channel.removeEventListener('message', handler)
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  set.get = get
  set.effect = effect
  return set
}
