import { defineBProgram, type DefineBProgramProps } from '../behavioral/define-b-program.js'
import type { BPEvent } from '../behavioral/b-thread.js'
import type { Disconnect, Handlers } from '../behavioral/b-program.js'

type WorkerContext = {
  send(data: BPEvent): void
  disconnect: Disconnect
}

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
