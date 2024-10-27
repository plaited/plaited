import { type BPEvent, type BSync, type BThread, bThread, bSync } from '../behavioral/b-thread.js'
import {
  type Actions,
  type UseSnapshot,
  type BThreads,
  type Trigger,
  bProgram,
  type Disconnect,
} from '../behavioral/b-program.js'
import { usePublicEvents } from '../client/use-public-events.js'

export const defineWorker = <A extends Actions>({
  connectedCallback,
  publicEvents,
}: {
  connectedCallback: (args: {
    send: {
      (data: BPEvent): void
      disconnect(): void
    }
    trigger: Trigger
    useSnapshot: UseSnapshot
    bThreads: BThreads
    bThread: BThread
    bSync: BSync
  }) => A
  publicEvents: string[]
}) => {
  const disconnectSet = new Set<Disconnect>()
  const { useFeedback, trigger, ...rest } = bProgram()
  const _trigger = usePublicEvents({ trigger, publicEvents, disconnectSet })
  const eventHandler = ({ data }: { data: BPEvent }) => {
    _trigger(data)
  }
  const context = self
  const send = (data: BPEvent) => context.postMessage(data)
  context.addEventListener('message', eventHandler, false)
  send.disconnect = () => {
    context.removeEventListener('message', eventHandler)
    disconnectSet.forEach((disconnect) => disconnect())
    disconnectSet.clear()
  }
  const actions = connectedCallback({ trigger, send, bThread, bSync, ...rest })
  useFeedback(actions)
}
