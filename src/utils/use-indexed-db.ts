import type { Trigger } from '../behavioral/b-program.js'
import { type PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from '../main/plaited.guards.js'

const PLAITED_INDEXED_DB = 'PLAITED_INDEXED_DB'
const PLAITED_STORE = 'PLAITED_STORE'

type CreateIDBCallback = (arg: IDBObjectStore) => void

// Async Pub Sub that allows us the get Last Value Cache and subscribe to changes and persist the value in indexedDB
export const useIndexedDB = async <T>(
  /** key for stored value */
  key: string,
  /** you can actually pass it an reference to another indexedDB */
  options?: {
    databaseName?: string
    storeName?: string
  },
) => {
  const databaseName = options?.databaseName ?? PLAITED_INDEXED_DB
  const storeName = options?.storeName ?? PLAITED_STORE
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
      transaction.oncomplete = () => {
        dbp.close()
        resolve()
      }
      transaction.onabort = transaction.onerror = () => reject(transaction.error)
      callback(transaction.objectStore(storeName))
    })
  }

  const get = async () => {
    let req: IDBRequest<T>
    return db('readonly', (store) => {
      req = store.get(key)
    }).then(() => req.result)
  }

  const set = async (newValue: T) => {
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    await db('readwrite', (store) => store.put(newValue, key))
    const next = await get()
    channel.postMessage(next)
    channel.close()
  }

  const listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    const handler = (event: MessageEvent<T>) => trigger<T>({ type: eventType, detail: event.data })
    getLVC && void get().then((value) => trigger<T>({ type: eventType, detail: value }))
    channel.addEventListener('message', handler)
    const disconnect = () => channel.removeEventListener('message', handler)
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  return {
    get,
    set,
    listen,
  }
}
