import type { ConnectArgs, Disconnect, PlaitedElement, Trigger } from '../types.js'
import { noop } from '@plaited/utils'
import { bpAddress } from '../jsx/constants.js'

export const useConnect =
  ({ trigger, disconnectSet, host }: { trigger: Trigger; disconnectSet: Set<Disconnect>; host: PlaitedElement }) =>
  (...args: ConnectArgs) => {
    if (args.length === 2) {
      const [type, pub] = args
      const cb = pub.sub(type, trigger)
      disconnectSet.add(cb)
      return () => {
        disconnectSet.delete(cb)
        cb()
      }
    }
    const [source] = args
    if (source.type === 'worker') {
      const cb = source.connect(trigger)
      disconnectSet.add(cb)
      return () => {
        disconnectSet.delete(cb)
        cb()
      }
    }
    const address = host.getAttribute(bpAddress) ?? undefined
    if (!address) {
      console.error(`Component ${host.tagName.toLowerCase()} is missing an attribute [${bpAddress}]`)
      return noop // if we're missing an address on our component return noop and console.error msg
    }
    const cb = source.connect(trigger, address)
    disconnectSet.add(cb)
    return () => {
      disconnectSet.delete(cb)
      cb()
    }
  }
