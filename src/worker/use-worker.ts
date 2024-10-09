import { type BPEvent, isBPEvent } from '../behavioral/b-thread.ts'
import { type Trigger } from '../behavioral/b-program.ts'
import { type PlaitedTrigger, isPlaitedTrigger } from '../client/client.types.ts'

export const useWorker = (trigger: PlaitedTrigger | Trigger, path: string) => {
  const handleMessage = (event: MessageEvent<BPEvent>) => {
    isBPEvent(event.data) && trigger(event.data)
  }
  const worker = new Worker(path, { type: 'module' })

  worker.addEventListener('message', handleMessage)
  const post = <T>(args: BPEvent<T>) => worker?.postMessage(args)
  const disconnect = () => {
    worker?.removeEventListener('message', handleMessage)
  }
  isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
  post.disconnect = disconnect
  return post
}
