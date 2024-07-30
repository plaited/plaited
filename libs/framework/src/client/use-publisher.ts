import type { PlaitedElement } from './types.js'
import { noop } from '@plaited/utils'

export function usePublisher<T>(initialValue: T): {
  (value: T): void
  sub(host: PlaitedElement, eventType: string): () => void
  get(): T
}
export function usePublisher<T = undefined>(
  initialValue?: never,
): {
  (value?: T): void
  sub(host: PlaitedElement, eventType: string): () => void
  get(): T | undefined
}
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
  const sub = (host: PlaitedElement, eventType: string) => {
    if (host.publicEvents?.includes(eventType)) {
      console.error(`Event [${eventType}] is not public`)
      return noop
    }
    const cb = (detail?: T) => host.trigger<T>({ type: eventType, detail })
    listeners.add(cb)
    const disconnect = () => {
      listeners.delete(cb)
    }
    host.addDisconnectedCallback(disconnect)
    return disconnect
  }
  pub.sub = sub
  pub.get = get
  return pub
}
