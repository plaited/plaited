import type { Trigger } from '../behavioral/types.js'
import type { ConnectArgs, Disconnect } from './types.js'

export const useConnect =
  ({ trigger, disconnectSet }: { trigger: Trigger; disconnectSet: Set<Disconnect> }) =>
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
    const cb = source.connect(trigger)
    disconnectSet.add(cb)
    return () => {
      disconnectSet.delete(cb)
      cb()
    }
  }
