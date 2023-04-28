import { trueTypeOf } from '@plaited/utils'
import { createIDB } from './create-idb.js'
import { Disconnect } from './types.js'

type UpdateStoreArg<T = unknown> = (arg: T) => T
interface Get<T> {
  (): Promise<T>
  subscribe: (cb: (arg: T) => void) => Disconnect
}
type Set<T> = (newValue: T | UpdateStoreArg<T>) => Promise<T>

/** asynchronously get and set indexed db values */
export const useIndexedDB = async <T = unknown>(
  /** key for stored value */
  key: string,
  /** initial value can be null */
  initialValue?: T,
  /** you can actually pass it an reference to another indexedDB */
  option?: { databaseName: string; storeName: string }
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

  const overwriteStore = (newValue: T) =>
    db('readwrite', store => store.put(newValue, key))

  // If initial value provided overwrite store
  initialValue !== undefined && await overwriteStore(initialValue)

  const updateStore = (newValue: UpdateStoreArg<T>) =>
    db('readwrite', store => {
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

  const set = async (newValue: T | UpdateStoreArg<T>) => {
    await trueTypeOf(newValue) === 'function'
      ? updateStore(newValue as UpdateStoreArg<T>)
      : overwriteStore(newValue as T)
    const next = await get()
    channel.postMessage(next)
    return next
  }

  const get = () => {
    let req: IDBRequest<T>
    return db('readonly', store => {
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
  return Object.freeze([ get, set ])
}
