import { Trigger, BPEvent } from '@plaited/behavioral'
import { trueTypeOf } from '@plaited/utils'
import { onlyObservedTriggers } from './only-observed-triggers.js'

/**
 * @description Is a utility function that allows us to send messages
 * to and receive messages from the window, in a worker or iframe
 */
export const handlePostMessage = ({
  trigger,
  observedTriggers,
  targetOrigin = '*',
}: {
  trigger: Trigger
  observedTriggers: string[]
  targetOrigin?: string
}) => {
  const _trigger = onlyObservedTriggers(trigger, observedTriggers)
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
