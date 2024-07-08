import type { Trigger } from '../behavioral/types.js'
import type { UsePublisher } from './types.js'

export const usePublisher: UsePublisher = <T = unknown>() => {
  const listeners = new Set<(value?: T) => void>()
  // The publisher function that notifies all subscribed listeners with optional value.
  const pub = (value?: T) => {
    for (const cb of listeners) cb(value)
  }
  // Subscribes a trigger and BPEvent to the publisher.
  const sub = (type: string, trigger: Trigger) => {
    const cb = (detail?: T) => trigger<T>({ type, detail })
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }
  pub.type = 'publisher' as const
  pub.sub = sub
  return pub
}
