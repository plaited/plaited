import type {
  BPEvent,
  Trigger,
  SynchronizationPoint,
  UseSnapshot,
  BThreads,
  Synchronize,
  Actions,
} from '../behavioral/types.js'
import { bProgram } from '../behavioral/b-program.js'
import { sync, point } from '../behavioral/sync.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'
import { PLAITED_WORKER_IDENTIFIER } from '../shared/constants.js'

export const defineWorker = ({
  id,
  connectedCallback,
  publicEvents,
  targetOrigin,
}: {
  id: string
  connectedCallback: (args: {
    send: {
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
  const toRet = () => {
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
    const actions = connectedCallback({ trigger, send, sync, point, ...rest })
    useFeedback(actions)
  }
  toRet.id = id
  toRet.$ = PLAITED_WORKER_IDENTIFIER
  return toRet
}
