import { bProgram } from '../behavioral/b-program.js'
import type { DefineWorkerArgs } from './types.js'
import type { BPEvent } from '../behavioral/types.js'
import { sync, loop, thread } from '../behavioral/rules-function.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'

export const defineWorker = ({ bp, publicEvents, targetOrigin }: DefineWorkerArgs) => {
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
  const actions = bp({ trigger, send, sync, loop, thread, ...rest})
  feedback(actions)
}
