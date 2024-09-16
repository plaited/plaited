import type { Trigger } from '../behavioral.js'
import type { SubscribeToPublisher, Disconnect } from '../internal/internal.types.js'

export function useStore<T>(initialValue: T): {
  (value: T): void
  sub: SubscribeToPublisher
  get(): T
}
export function useStore<T>(initialValue?: never): {
  (value?: T): void
  sub: SubscribeToPublisher
  get(): T | undefined
}
// Pub Sub that allows us the get Last Value Cache (LVC)and subscribe to changes
export function useStore<T>(initialValue: T) {
  let store: T = initialValue
  const listeners = new Set<(value?: T) => void>()
  const get = () => store
  // The publisher function that notifies all subscribed listeners with optional value.
  const set = (value: T) => {
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
  set.sub = sub
  set.get = get
  return set
}

export const useComputed = <T>(initialValue: () => T, deps: ReturnType<typeof useStore>[]) => {
  let store: T
  const listeners = new Set<(value?: T) => void>()
  const get = () => {
    if (!store) store = initialValue()
    return store
  }
  const disconnectDeps: Disconnect[] = []
  const update: Trigger = (..._) => {
    store = initialValue()
    for (const cb of listeners) cb(store)
  }
  const sub: SubscribeToPublisher = (eventType: string, trigger: Trigger, getLVC = false) => {
    if (!listeners.size) disconnectDeps.push(...deps.map((dep) => dep.sub('update', update)))
    const cb = (detail?: T) => trigger<T>({ type: eventType, detail })
    getLVC && cb(get())
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
      if (!listeners.size) for (const dep of disconnectDeps) dep()
    }
  }
  get.sub = sub
  return get
}