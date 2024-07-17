import type { Trigger } from '../behavioral/types.js'
import type { UsePublisher } from './types.js'
import type { Disconnect } from './types.js'

export const connectToPublisher =
  (trigger: Trigger, addDisconnect: (arg: Disconnect) => Set<Disconnect>) =>
  (type: string, pub: ReturnType<UsePublisher>) => {
    const cb = pub.sub(type, trigger)
    const set = addDisconnect(cb)
    const disconnect = () => {
      set.delete(cb)
      cb()
    }
    return disconnect
  }
