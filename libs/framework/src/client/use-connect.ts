import type { Trigger } from '../behavioral/types.js'
import type { ConnectArgs, Disconnect } from './types.js'
import { noop } from '@plaited/utils';
import { BP_ADDRESS } from '../jsx/constants.js';
export const useConnect =
  ({ trigger, disconnectSet, address }: { trigger: Trigger; disconnectSet: Set<Disconnect>, address?: string }) =>
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
    if(source.type  === 'worker') {
      const cb = source.connect(trigger)
      disconnectSet.add(cb)
      return () => {
        disconnectSet.delete(cb)
        cb()
      }
    }
    if(!address) {
      console.error(`${BP_ADDRESS} is required`)
      return () => noop
    }
    const cb = source.subscribe(address, trigger)
      disconnectSet.add(cb)
      return () => {
        disconnectSet.delete(cb)
        cb()
      }
  }
