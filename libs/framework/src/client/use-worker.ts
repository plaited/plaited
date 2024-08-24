import type { BPEvent } from '../behavioral/types.js'
import type { PlaitedElement } from './types.js'
import { isTypeOf, noop } from '@plaited/utils'
import { P_WORKER } from './constants.js'
/**
 * Enables communication between agents on the main thread and a dedicated postMessage client
 */

const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}
export type PostToWorker =  {
  <T>(args: BPEvent<T>): void;
  disconnect(): void;
}
export const useWorker = (host: PlaitedElement):[PostToWorker, (path:string | null) => void] => {
  let worker: Worker
  let send: PostToWorker = noop as PostToWorker
  send.disconnect = noop
  const handleMessage = (event: MessageEvent<BPEvent>) => {
    isBPEvent(event.data) && host.trigger(event.data)
  }
  const updateWorker = (path: string | null) => {
    worker?.removeEventListener('message', handleMessage)
    if(!path) {
      send = noop as PostToWorker
      send.disconnect = noop
      return console.error(`Missing directive: ${P_WORKER}`)
    }
    worker = new Worker(path, { type: 'module' })
    worker.addEventListener('message', handleMessage)
    const post = <T>(args: BPEvent<T>) => worker.postMessage(args)
    post.disconnect = () => worker.removeEventListener('message', handleMessage)
    send = post
  }
  return [send, updateWorker]
}
