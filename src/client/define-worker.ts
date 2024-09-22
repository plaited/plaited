import { type BPEvent, type BSync, type BThread, bThread, bSync } from '../behavioral/b-thread.js'
import { type Actions, type UseSnapshot, type BThreads, type Trigger, bProgram } from '../behavioral/b-program.js'
import { usePublicEvents } from './use-public-events.js'

export const defineWorker = ({
  connectedCallback,
  publicEvents,
  targetOrigin,
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
  }) => Actions
  publicEvents: string[]
  targetOrigin?: string
}) => {
  const { useFeedback, trigger, ...rest } = bProgram()
  const _trigger = usePublicEvents(trigger, publicEvents)
  const eventHandler = ({ data }: { data: BPEvent }) => {
    _trigger(data)
  }
  const context = self
  const send = (data: BPEvent) => {
    targetOrigin ? context.postMessage(data, targetOrigin) : context.postMessage(data)
  }
  context.addEventListener('message', eventHandler, false)
  send.disconnect = () => context.removeEventListener('message', eventHandler)
  const actions = connectedCallback({ trigger, send, bThread, bSync, ...rest })
  useFeedback(actions)
}
