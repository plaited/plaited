import type { BPEvent, Trigger } from '../behavioral/types.js'
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
export const useWorker = (host: { trigger: Trigger }):[PostToWorker, (path:string | null) => void] => {
  let worker: Worker
  const fallback: PostToWorker = noop as PostToWorker
  fallback.disconnect = noop
  const handleMessage = (event: MessageEvent<BPEvent>) => {
    isBPEvent(event.data) && host.trigger(event.data)
  }
  let post: PostToWorker = fallback
  const updateWorker = (path: string | null) => {
    worker?.removeEventListener('message', handleMessage)
    if(!path) {
      post = fallback
      return console.error(`Missing directive: ${P_WORKER}`)
    }
    worker = new Worker(path, { type: 'module' })
    worker.addEventListener('message', handleMessage)
    const next = <T>(args: BPEvent<T>) => worker.postMessage(args)
    next.disconnect = () => worker.removeEventListener('message', handleMessage)
    post = next
  }
  const send: PostToWorker =  <T>(args: BPEvent<T>) => post(args)
  send.disconnect = () => post.disconnect()
  return [send, updateWorker]
}
