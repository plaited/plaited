import { noop } from '@plaited/utils'
import { bpAddress } from '../jsx/constants.js'
import { EventSources, PlaitedElement, Disconnect, Trigger } from '../types.js'

const logMissingObserverTriggers = (host: PlaitedElement, source: EventSources['type']) => {
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
}): [(comm: EventSources) => Disconnect, () => void] => {
  const disconnectCallbacks = new Set<() => void>()

  const disconnectEventSource = (cb: () => void) => {
    disconnectCallbacks.add(cb)
    return () => {
      cb()
      disconnectCallbacks.delete(cb)
    }
  }

  /** connect trigger to a Server Sent Event, Web Socket or Messenger */
  const connect = (comm: EventSources) => {
    if (comm?.type === 'worker') return disconnectEventSource(comm.connect(trigger))
    const address = host.getAttribute(bpAddress) ?? undefined
    if (!address) {
      console.error(`Component ${host.tagName.toLowerCase()} is missing an attribute [${bpAddress}]`)
      return noop // if we're missing an address on our component return noop and console.error msg
    }
    if (comm?.type === 'sse') return disconnectEventSource(comm(trigger, address))
    if (comm?.type === 'ws') return disconnectEventSource(comm.connect(trigger, address))
    if (comm?.type === 'publisher') return disconnectEventSource(comm(trigger))
    if (!observedTriggers) return logMissingObserverTriggers(host, comm.type)
    if (comm?.type === 'messenger' && observedTriggers)
      return disconnectEventSource(comm.connect({ trigger, observedTriggers, address }))
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
