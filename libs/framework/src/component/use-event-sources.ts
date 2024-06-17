import { noop } from '@plaited/utils'
import { bpAddress } from '../jsx/constants.js'
import { Messenger, SSE, WS, PostMessenger, Publisher, PlaitedElement, Disconnect, Trigger } from '../types.js'

type ObservedTriggerSources = Publisher['type'] | Messenger['type'] | PostMessenger['type']

const logMissingObserverTriggers = (host: PlaitedElement, source: ObservedTriggerSources) => {
  console.error(
    `Component ${host.tagName.toLowerCase()} is missing observerTriggers. To connect ${source} please provide observed triggers`,
  )
  return noop
}
export const useEventSources = ({
  trigger,
  observedTriggers,
  host,
}: {
  trigger: Trigger
  observedTriggers?: string[]
  host: PlaitedElement
}): [(comm: Messenger | Publisher | SSE | WS | PostMessenger) => Disconnect, () => void] => {
  const disconnectCallbacks = new Set<() => void>()
  const disconnectEventSource = (cb: () => void) => {
    disconnectCallbacks.add(cb)
    return () => disconnectCallbacks.delete(cb)
  }
  /** connect trigger to a Messenger, Publisher, Server Sent Event, Web Socket or PostMessenger */
  const connect = (comm: Messenger | Publisher | SSE | WS | PostMessenger) => {
    if (comm?.type === 'sse') return disconnectEventSource(comm(trigger))
    if (comm?.type === 'ws') return disconnectEventSource(comm.connect(trigger))
    if (!observedTriggers) return logMissingObserverTriggers(host, comm.type)
    if (comm?.type === 'publisher' && observedTriggers)
      return disconnectEventSource(comm.connect(trigger, observedTriggers))
    if (comm?.type === 'post-messenger' && observedTriggers)
      return disconnectEventSource(comm.connect(trigger, observedTriggers))
    if (comm?.type === 'messenger' && observedTriggers) {
      const recipient = host.getAttribute(bpAddress)
      if (!recipient) {
        console.error(`Component ${host.tagName.toLowerCase()} is missing an attribute [${bpAddress}]`)
        return noop // if we're missing an address on our component return noop and console.error msg
      }
      return disconnectEventSource(comm.connect({ recipient, trigger, observedTriggers }))
    }
    return noop
  }

  const disconnect = () => {
    if (disconnectCallbacks.size) {
      disconnectCallbacks.forEach((unsubscribe) => unsubscribe())
      disconnectCallbacks.clear()
    }
  }
  return [connect, disconnect]
}
