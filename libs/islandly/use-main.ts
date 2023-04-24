import { Trigger, TriggerArgs } from '../behavioral/mod.ts'
import { Disconnect } from './types.ts'

type Send = (recipient: string, detail: TriggerArgs) => void
/** is a hook to allow us to send and receive messages from the main thread in a worker */
export const useMain = (
  /** is self of the worker */
  context: Window & typeof globalThis,
  trigger: Trigger,
) => {
  const eventHandler = ({ data }: { data: TriggerArgs }) => {
    trigger(data)
  }
  const send = (recipient: string, detail: TriggerArgs) => {
    context.postMessage({
      recipient,
      detail,
    })
  }
  context.addEventListener('message', eventHandler, false)
  const disconnect = () => context.removeEventListener('message', eventHandler)
  return Object.freeze<[Send, Disconnect]>([send, disconnect])
}
