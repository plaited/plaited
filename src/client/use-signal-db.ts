import type { Trigger, Disconnect } from '../behavioral/b-program.js'
import type { PlaitedTrigger, Effect } from '../client/client.types.js'
import { isPlaitedTrigger } from './client.guards.js'
import { PLAITED_INDEXED_DB, PLAITED_STORE } from '../client/client.constants.js'

type CreateIDBCallback = (arg: IDBObjectStore) => void
type ComputedTrigger = () => Promise<void>

type SignalWithInitialValue<T> = {
  (value: T): Promise<void>
  effect: Effect
  get(): Promise<T>
}

type SignalWithoutInitialValue<T> = {
  (value?: T): Promise<void>
  effect: Effect
  get(): Promise<T | undefined>
}

export function useSignalDB<T>(
  key: string,
  initialValue: T,
  option?: {
    databaseName: string
    storeName: string
  },
): Promise<SignalWithInitialValue<T>>
export function useSignalDB<T>(
  key: string,
  initialValue?: never,
  options?: {
    databaseName: string
    storeName: string
  },
): Promise<SignalWithoutInitialValue<T>>
export async function useSignalDB<T>(
  /** key for stored value */
  key: string,
  /** initial value can be undefined */
  initialValue: T,
  /** you can actually pass it an reference to another indexedDB */
  options?: {
    databaseName?: string
    storeName?: string
  },
) {
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
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () => reject(transaction.error)
      callback(transaction.objectStore(storeName))
    })
  }
  if (initialValue !== undefined) {
    await db('readwrite', (store) => store.put(initialValue, key))
  }
  const get = () => {
    let req: IDBRequest<T>
    return db('readonly', (store) => {
      req = store.get(key)
    }).then(() => req.result)
  }
  const set = async (value: T) => {
    await db('readwrite', (store) => store.put(value, key))
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    channel.postMessage(value)
    channel.close()
  }
  const effect = (eventType: string, trigger: Trigger | PlaitedTrigger | ComputedTrigger, getLVC = false) => {
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    const handler = async (event: MessageEvent<T>) => await trigger<T>({ type: eventType, detail: event.data })
    getLVC && void get().then((value) => trigger<T>({ type: eventType, detail: value }))
    channel.addEventListener('message', handler)
    const disconnect = () => {
      channel.removeEventListener('message', handler)
      channel.close()
    }
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  set.get = get
  set.effect = effect
  return set
}

export const useComputedDB = <T>(
  initialValue: () => Promise<T>,
  deps: (SignalWithInitialValue<T> | SignalWithoutInitialValue<T>)[],
) => {
  let store: T
  const listeners = new Set<(value?: T) => void>()
  const get = async () => {
    if (!store) store = await initialValue()
    return store
  }
  const disconnectDeps: Disconnect[] = []
  const update: ComputedTrigger = async () => {
    store = await initialValue()
    for (const cb of listeners) cb(store)
  }
  const effect = async (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    if (!listeners.size) disconnectDeps.push(...deps.map((dep) => dep.effect('update', update)))
    const cb = (detail?: T) => trigger<T>({ type: eventType, detail })
    getLVC && cb(await get())
    listeners.add(cb)
    const disconnect = () => {
      listeners.delete(cb)
      if (!listeners.size) for (const dep of disconnectDeps) dep()
    }
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  get.effect = effect
  return get
}
