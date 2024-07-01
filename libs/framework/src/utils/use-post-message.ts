import { trueTypeOf } from '@plaited/utils'
import { Trigger, BPEvent } from '../types.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'

/**
 * @description Is a utility function that allows us to send messages
 * to and receive messages from the window, in a worker or iframe
 */
export const usePostMessage = ({
  trigger,
  publicEvents,
  targetOrigin = '*',
}: {
  trigger: Trigger
  publicEvents: string[]
  targetOrigin?: string
}) => {
  const _trigger = onlyPublicEvents(trigger, publicEvents)
  const eventHandler = ({ data }: { data: BPEvent }) => {
    _trigger(data)
  }
  const context = self
  const send = (data: BPEvent) => {
    trueTypeOf(context) === 'window' ? context.postMessage(data, targetOrigin) : context.postMessage(data)
  }
  context.addEventListener('message', eventHandler, false)
  send.disconnect = () => context.removeEventListener('message', eventHandler)
  return send
}
