import type { BPEvent, Trigger, SynchronizationPoint, UseSnapshot, BThreads, Synchronize, Actions } from '../behavioral/types.js'
import { bProgram } from '../behavioral/b-program.js'
import { sync, point } from '../behavioral/sync.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'

export const defineWorker = ({ connectedCallback, publicEvents, targetOrigin }:  {
  connectedCallback: (args: {
    send:{
      (data: BPEvent): void
      disconnect(): void
    }
    trigger: Trigger
    useSnapshot: UseSnapshot
    bThreads: BThreads
    sync: Synchronize
    point: SynchronizationPoint
  }) => Actions
  publicEvents: string[]
  targetOrigin?: string
}) => {
  const { useFeedback, trigger, ...rest } = bProgram()
  const _trigger = onlyPublicEvents(trigger, publicEvents)
  const eventHandler = ({ data }: { data: BPEvent }) => {
    _trigger(data)
  }
  const context = self
  const send = (data: BPEvent) => {
    targetOrigin ? context.postMessage(data, targetOrigin) : context.postMessage(data)
  }
  context.addEventListener('message', eventHandler, false)
  send.disconnect = () => context.removeEventListener('message', eventHandler)
  const actions = connectedCallback({ trigger, send, sync, point, ...rest})
  useFeedback(actions)
}
