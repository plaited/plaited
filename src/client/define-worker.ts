import {
  BPEvent,
  Trigger,
  BSync,
  UseSnapshot,
  BThreads,
  BThread,
  Actions,
  bProgram,
  bThread,
  bSync,
} from '../behavioral.js'
import { usePublicEvents } from '../internal/use-public-events.js'

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
