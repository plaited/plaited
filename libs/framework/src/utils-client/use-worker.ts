import { Trigger, BPEvent } from '../behavioral/types.js'
import type { UseWorker } from './types.js'
import { isTypeOf } from '../utils.js'
/**
 * Enables communication between agents on the main thread and a dedicated postMessage client
 */

const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}

export const useWorker: UseWorker = (scriptURL, options) => {
  const worker = new Worker(scriptURL, options)
  const post = (args: BPEvent) => worker.postMessage(args)
  const connect = (trigger: Trigger) => {
    const handleMessage = (event: MessageEvent<BPEvent>) => {
      isBPEvent(event.data) && trigger(event.data)
    }
    worker.addEventListener('message', handleMessage)
    return () => worker.removeEventListener('message', handleMessage)
  }
  post.connect = connect
  return post
}
