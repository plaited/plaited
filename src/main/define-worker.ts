import { defineBProgram, type DefineBProgramProps } from '../behavioral/define-b-program.js'
import type { BPEvent } from '../behavioral/b-thread.js'
import type { Disconnect, Handlers } from '../behavioral/b-program.js'

type WorkerContext = {
  send(data: BPEvent): void
  disconnect: Disconnect
}
/**
 * Creates a behavioral program worker with type-safe message handling and lifecycle management.
 * Integrates Web Workers with Plaited's behavioral programming system.
 *
 * @template A Type extending Handlers for event handling
 *
 * @param options Configuration object
 * @param options.bProgram Function defining worker behavior and event handlers
 * @param options.publicEvents Array of allowed event types
 *
 * Features:
 * - Type-safe message handling
 * - Automatic event filtering
 * - Resource cleanup management
 * - Behavioral programming integration
 * - Worker context management
 *
 * @example Basic Worker Definition
 * ```ts
 const calculator = {
   add(a: number, b: number) {
     return a + b
   },
   subtract(a: number, b: number) {
     return a - b
   },
   multiply(a: number, b: number) {
     return a * b
   },
   divide(a: number, b: number) {
     return a / b
   },
 }

 defineWorker<{
   calculate: (args: { a: number; b: number; operation: 'add' | 'subtract' | 'multiply' | 'divide' }) => void
 }>({
   publicEvents: ['calculate'],
   bProgram({ send }) {
     return {
       calculate({ a, b, operation }) {
         send({
           type: 'update',
           detail: calculator[operation](a, b),
         })
       },
     }
   },
 })
 * ```
 *
 * @remarks
 * - Runs in Worker context only
 * - Automatically manages message event listeners
 * - Handles cleanup on termination
 * - Provides type-safe message passing
 * - Filters events based on publicEvents
 * - Integrates with Plaited's behavioral system
 *
 */
export const defineWorker = <A extends Handlers>({
  bProgram,
  publicEvents,
}: {
  bProgram: (args: DefineBProgramProps & WorkerContext) => A
  publicEvents: string[]
}) => {
  const disconnectSet = new Set<Disconnect>()
  const context = self
  const send = (data: BPEvent) => context.postMessage(data)
  const init = defineBProgram<A, WorkerContext>({
    publicEvents,
    disconnectSet,
    bProgram,
  })
  const publicTrigger = init({
    send,
    disconnect: () => disconnectSet.forEach((disconnect) => disconnect()),
  })
  const eventHandler = ({ data }: { data: BPEvent }) => {
    publicTrigger(data)
  }
  init.addDisconnectCallback(() => {
    context.removeEventListener('message', eventHandler)
    disconnectSet.clear()
  })
  context.addEventListener('message', eventHandler, false)
}
