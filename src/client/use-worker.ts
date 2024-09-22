import { type BPEvent, isBPEvent } from '../behavioral/b-thread.js'
import type { Trigger } from '../behavioral/b-program.js'

export type PostToWorker = {
  <T>(args: BPEvent<T>): void
  disconnect(): void
}

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
