import { type BPEvent, isBPEvent } from '../behavioral/b-thread.js'
import { type Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from './plaited.guards.js'

/**
 * Creates a type-safe interface for Web Worker communication with automatic cleanup.
 * Integrates workers with Plaited's event system for seamless messaging.
 *
 * @param trigger Event trigger function for worker responses
 * @param path Path to the worker module file
 * @returns Enhanced postMessage function with disconnect capability
 *
 * @example Basic Usage
 * ```ts
 test('userWorker|defineWorker: send and receive', async () => {
   const spy = sinon.spy()
   const send = useWorker((evt: BPEvent) => spy(evt), `${import.meta.dir}/worker.ts`)
   send({
     type: 'calculate',
     detail: { a: 9, b: 10, operation: 'multiply' },
   })
   await wait(200)
   expect(
     spy.calledWith({
       type: 'update',
       detail: 90,
     }),
   ).toBeTruthy()
 })
 *```
 *
 * Features:
 * - Type-safe message passing
 * - Automatic event handling
 * - Resource cleanup
 * - Module worker support
 * - Plaited event integration
 *
 * @returns {PostMessage & { disconnect: () => void }}
 * - postMessage function for sending data to worker
 * - disconnect method for cleanup
 *
 * @remarks
 * - Creates a module-type worker
 * - Automatically validates incoming messages
 * - Handles cleanup through disconnect method
 * - Integrates with Plaited's trigger system
 * - Supports TypeScript generics for type safety
 * - Manages worker lifecycle
 */
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
