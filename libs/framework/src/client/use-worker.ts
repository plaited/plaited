import type { Trigger, BPEvent } from '../behavioral/types.js'
import { isBPEvent } from '../behavioral/is-bp-event.js'
import { PostToWorker } from './types.js'

export const useWorker = (host: { trigger: Trigger }, path: string): PostToWorker => {
  const handleMessage = (event: MessageEvent<BPEvent>) => {
    isBPEvent(event.data) && host.trigger(event.data)
  }
  const worker = new Worker(path, { type: 'module' })
  worker.addEventListener('message', handleMessage)
  const post = <T>(args: BPEvent<T>) => worker?.postMessage(args)
  post.disconnect = () => {
    worker?.removeEventListener('message', handleMessage)
  }
  return post
}
