import type { UsePostMessage } from './types.js'
import type { BPEvent } from '../behavioral/types.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'

/**
 * @description Is a utility function that allows us to send messages
 * to and receive messages from the window, in a worker or iframe
 */
export const usePostMessage: UsePostMessage = ({ trigger, publicEvents, targetOrigin }) => {
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
