import { trueTypeOf } from '../utils/mod.ts'
import { createIDB } from './create-idb.ts'
import { Disconnect } from './types.ts'

type UpdateStoreArg<T = unknown> = (arg: T) => T
interface Get<T> {
  (): Promise<T>
  subscribe: (cb: (arg: T) => void) => Disconnect
}
type Set<T> = (newValue: T | UpdateStoreArg<T>) => Promise<void>

/** asynchronously get and set indexed db values */
export const useIndexedDB = async <T = unknown>(
  /** key for stored value */
  key: string,
  /** initial value can be null */
  initialValue?: T,
  /** you can actually pass it an reference to another indexedDB */
  option?: { databaseName: string; storeName: string },
): Promise<
  readonly [
    Get<T>,
    Set<T>,
  ]
> => {
  const databaseName = option?.databaseName ?? 'USE_INDEXED_DB'
  const storeName = option?.storeName ?? 'STORE'
  const db = createIDB(databaseName, storeName)
  const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
  initialValue !== undefined && await (function setInitialValue() {
    return db('readwrite', (store) => {
      store.put(initialValue, key)
    })
  })()

  const updateStore = (newValue: UpdateStoreArg<T>) =>
    db('readwrite', (store) => {
      const req = store.openCursor(key)
      req.onsuccess = function getAndPutOnSuccess() {
        const cursor = this.result
        if (cursor) {
          const { value } = cursor
          cursor.update(newValue(value))
          return
        } else {
          console.error(`cursor's value missing`)
        }
      }
    })

  const overwriteStore = (newValue: T) =>
    db('readwrite', (store) => store.put(newValue, key))

  const set = async (newValue: T | UpdateStoreArg<T>) => {
    await trueTypeOf(newValue) === 'function'
      ? updateStore(newValue as UpdateStoreArg<T>)
      : overwriteStore(newValue as T)
    const next = await get()
    channel.postMessage(next)
  }

  const get = () => {
    let req: IDBRequest<T>
    return db('readonly', (store) => {
      req = store.get(key)
    }).then(() => req.result)
  }
  get.subscribe = (cb: (arg: T) => void) => {
    const channel = new BroadcastChannel(`${databaseName}_${storeName}_${key}`)
    const handler = (event: MessageEvent<T>) => {
      cb(event.data)
    }
    channel.addEventListener('message', handler)
    return () => channel.removeEventListener('message', handler)
  }
  return Object.freeze([get, set])
}
