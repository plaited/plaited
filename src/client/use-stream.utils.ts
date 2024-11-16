import type { BPEvent } from '../behavioral/b-thread.js'
import type { PlaitedMessage, PlaitedElement } from '../client/client.types.js'
import type { CustomElementTag } from '../jsx/jsx.types.js'

type CreateIDBCallback = (arg: IDBObjectStore) => void

const databaseName = '__PLAITED__'
const storeName = 'PLAITED_INBOX'

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

const getLastMessage = (address: string) => {
  let req: IDBRequest<BPEvent>
  return db('readonly', (store) => {
    req = store.get(address)
  }).then(() => req.result)
}

const getBroadcastChannelName = (address: string) => `${databaseName}_${storeName}_${address}`

export const getAddress = (tag: CustomElementTag, id?: string): string => `${tag}${id ? `#${id}` : ''}`

export const updateInbox = async ({ address, ...event }: PlaitedMessage) => {
  console.log('hit')
  await db('readwrite', (store) => store.put(event, address))
  const channel = new BroadcastChannel(getBroadcastChannelName(address))
  channel.postMessage(event)
  channel.close()
}

export const connectInbox = (host: PlaitedElement, getCache = false) => {
  const address = getAddress(host.tagName.toLowerCase() as CustomElementTag, host.id)
  const channel = new BroadcastChannel(getBroadcastChannelName(address))
  const handler = (evt: MessageEvent<PlaitedMessage>) => {
    host.trigger({ type: evt.data.type, detail: evt.data.detail })
  }
  const onGetCache = async () => {
    const value = await getLastMessage(address)
    value && host.trigger(value)
  }
  getCache && void onGetCache()
  channel.addEventListener('message', handler)
  const disconnect = () => {
    channel.removeEventListener('message', handler)
    channel.close()
  }
  host.trigger.addDisconnectCallback(disconnect)
  return disconnect
}
