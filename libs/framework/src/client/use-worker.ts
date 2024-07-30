import type { Trigger, BPEvent } from '../behavioral/types.js'
import type { PlaitedElement } from './types.js'
import { isTypeOf } from '@plaited/utils'

/**
 * Enables communication between agents on the main thread and a dedicated postMessage client
 */

const isBPEvent = (data: unknown): data is BPEvent => {
  return isTypeOf<{ [key: string]: unknown }>(data, 'object') && 'type' in data && isTypeOf<string>(data.type, 'string')
}

export const useWorker = (host: PlaitedElement, path: string | URL) => {
  const worker = new Worker(path, { type: 'module' })
  const handleMessage = (event: MessageEvent<BPEvent>) => {
    isBPEvent(event.data) && host.trigger(event.data)
  }
  worker.addEventListener('message', handleMessage)
  const disconnect = () => worker.removeEventListener('message', handleMessage)
  host.addDisconnectedCallback(disconnect)
  const post: Trigger = (args) => worker.postMessage(args)
  return post
}
