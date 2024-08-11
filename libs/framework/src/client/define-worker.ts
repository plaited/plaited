import type { BPEvent, Trigger, Rules, Snapshot, Thread, Loop, Sync, Actions } from '../behavioral/types.js'
import { bProgram } from '../behavioral/b-program.js'
import { sync, loop, thread } from '../behavioral/rules-function.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'

export const defineWorker = ({ connectedCallback, publicEvents, targetOrigin }:  {
  connectedCallback: (args: {
    send:{
      (data: BPEvent): void
      disconnect(): void
    }
    trigger: Trigger
    rules: Rules
    snapshot: Snapshot
    thread: Thread
    loop: Loop
    sync: Sync
  }) => Actions
  publicEvents: string[]
  targetOrigin?: string
}) => {
  const { feedback, trigger, ...rest } = bProgram()
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
  const actions = connectedCallback({ trigger, send, sync, loop, thread, ...rest})
  feedback(actions)
}
