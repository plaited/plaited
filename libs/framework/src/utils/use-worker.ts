import type { UseWorker, Trigger, BPEvent } from '../types.js'
import { isBPEvent } from './is-bp-event.js'
/**
 * Enables communication between agents on the main thread and a dedicated postMessage client
 */

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
  post.type = 'worker' as const
  return post
}
