import { Trigger, TriggerArgs } from '@plaited/behavioral'
import { Send } from './types.js'
/** Is a utility function to allow us to send and receive messages from the main thread in a worker */
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
  return Object.freeze<[Send, () => void]>([send, disconnect])
}
