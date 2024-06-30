import type { UseWorker, Trigger, BPEvent } from '../types.js'
/**
 * Enables communication between agents on the main thread and a dedicated postMessage client
 */

export const useWorker: UseWorker = (scriptURL, options) => {
  const worker = new Worker(scriptURL, options)
  const send = (args: BPEvent) => worker.postMessage(args)
  const connect = (trigger: Trigger) => {
    const handleMessage = (event: MessageEvent<BPEvent>) => trigger(event.data)
    worker.addEventListener('message', handleMessage)
    return () => worker.removeEventListener('message', handleMessage)
  }
  send.connect = connect
  send.type = 'worker' as const
  return send
}
