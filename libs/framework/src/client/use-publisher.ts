import { Trigger } from '../behavioral/types.js'
import { Disconnect } from '../shared/types.js'

export type SubscribeToPublisher =  (eventType: string, trigger:Trigger) =>  Disconnect
export type PublisherWithoutInitialValue<T = undefined> = {
  (value?: T): void
  sub:SubscribeToPublisher
  get(): T | undefined
}
export type PublisherWithInitialValue<T = unknown> = {
  (value: T): void
  sub: SubscribeToPublisher
  get(): T
}

export function usePublisher<T>(initialValue: T):PublisherWithInitialValue<T>
export function usePublisher<T = undefined>(initialValue?: never): PublisherWithoutInitialValue<T>
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
  const sub = (eventType: string, trigger: Trigger) => {
    const cb = (detail?: T) => trigger<T>({ type: eventType, detail })
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }
  pub.sub = sub
  pub.get = get
  return pub
}
