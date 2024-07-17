import { bProgram } from '../behavioral/b-program.js'
import { AddThreads, Trigger, Thread, Loop, Sync, Actions, Devtool, BPEvent } from '../behavioral/types.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'

type UsePostMessage = ({
  trigger,
  publicEvents,
  targetOrigin,
}: {
  trigger: Trigger
  publicEvents: string[]
  targetOrigin?: string
}) => {
  (data: BPEvent): void
  disconnect(): void
}

const usePostMessage: UsePostMessage = ({ trigger, publicEvents, targetOrigin }) => {
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
  return send
}

type DefineWorkerParams = [
  (args: {
    send: ReturnType<UsePostMessage>
    addThreads: AddThreads
    trigger: Trigger
    thread: Thread
    loop: Loop
    sync: Sync
  }) => Actions,
  { devtool?: Devtool; publicEvents: string[]; targetOrigin?: string },
]

type DefineWorker = (...args: DefineWorkerParams) => void

export const defineWorker: DefineWorker = (callback, { publicEvents, targetOrigin, devtool }) => {
  const { feedback, ...rest } = bProgram(devtool)
  const send = usePostMessage({
    trigger: rest.trigger,
    publicEvents,
    targetOrigin,
  })
  const actions = callback({ ...rest, send })
  feedback(actions)
}
