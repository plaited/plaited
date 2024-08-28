import { Trigger } from '../behavioral/types.js'
import { Disconnect } from '../shared/types.js'

export type SubscribeToPublisher = (eventType: string, trigger: Trigger, getLVC?: boolean) => Disconnect
export type Publisher<T> = ReturnType<typeof usePublisher<T>>
export function usePublisher<T>(initialValue: T): {
  (value: T): void
  sub: SubscribeToPublisher
  get(): T
}
export function usePublisher<T>(initialValue?: never): {
  (value?: T): void
  sub: SubscribeToPublisher
  get(): T | undefined
}
// Pub Sub that allows us the get Last Value Cache (LVC)and subscribe to changes
export function usePublisher<T>(initialValue: T) {
  let store: T = initialValue
  const listeners = new Set<(value?: T) => void>()
  const get = () => store
  // The publisher function that notifies all subscribed listeners with optional value.
  const pub = (value: T) => {
    store = value
    for (const cb of listeners) cb(value)
  }
  // Subscribes a trigger and BPEvent to the publisher.
  const sub = (eventType: string, trigger: Trigger, getLVC = false) => {
    const cb = (detail?: T) => trigger<T>({ type: eventType, detail })
    getLVC && cb(store)
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }
  pub.sub = sub
  pub.get = get
  return pub
}
