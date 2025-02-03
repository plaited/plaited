import type { Trigger } from '../behavioral/b-program.js'
import { type PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from '../main/plaited.guards.js'

const PLAITED_INDEXED_DB = 'PLAITED_INDEXED_DB'
const PLAITED_STORE = 'PLAITED_STORE'

type CreateIDBCallback = (arg: IDBObjectStore) => void

/**
 * Creates a persistent pub/sub store using IndexedDB with broadcast channel support.
 * Provides last-value-cache (LVC) functionality and cross-tab synchronization.
 *
 * Features:
 * - Persistent storage using IndexedDB
 * - Cross-tab/window communication
 * - Last-value-cache retrieval
 * - Type-safe data handling
 * - Automatic database initialization
 * - Clean disconnect handling
 *
 * @template T Type of data to be stored
 *
 * @param key Unique identifier for the stored value
 * @param options Configuration options
 * @param options.databaseName Custom IndexedDB database name (default: 'PLAITED_INDEXED_DB')
 * @param options.storeName Custom object store name (default: 'PLAITED_STORE')
 *
 * @returns Object containing:
 * - get(): Promise<T> Retrieves stored value
 * - set(value: T): Promise<void> Updates stored value and broadcasts change
 * - listen(eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean):
 *     () => void Subscribes to value changes
 *
 * @example
 * // Basic usage
 * const store = await useIndexedDB<UserData>('user-preferences');
 *
 * // Store data
 * await store.set({ theme: 'dark' });
 *
 * // Retrieve data
 * const data = await store.get();
 *
 * // Listen for changes
 * const disconnect = store.listen('USER_UPDATED', trigger, true);
 *
 * @example
 * // Custom database configuration
 * const store = await useIndexedDB<Config>('settings', {
 *   databaseName: 'MyApp',
 *   storeName: 'Configuration'
 * });
 *
 * @remarks
 * - Uses BroadcastChannel for cross-tab communication
 * - Automatically handles database creation and upgrades
 * - Provides disconnect callbacks for cleanup
 * - Supports last-value-cache pattern with getLVC parameter
 * - Thread-safe for concurrent access
 */
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
