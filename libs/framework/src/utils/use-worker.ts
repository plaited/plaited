import type { UseWorker, Trigger, BPEvent } from '../types.js'
/**
 * Enables communication between agents on the main thread and a dedicated postMessage client
 */

export const useWorker = (client: Worker): UseWorker => {
  const send = (args: BPEvent) => client.postMessage(args)
  const connect = (trigger: Trigger) => {
    const handleMessage = (event: MessageEvent<BPEvent>) => trigger(event.data)
    client.addEventListener('message', handleMessage)
    return () => client.removeEventListener('message', handleMessage)
  }
  send.connect = connect
  send.type = 'worker' as const
  return send
}
