import type { Trigger, Disconnect } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { type Effect } from './plaited.types.js'
import { isPlaitedTrigger } from './plaited.guards.js'

type SignalWithInitialValue<T> = {
  (value: T): void
  effect: Effect
  get(): T
}

type SignalWithoutInitialValue<T> = {
  (value?: T): void
  effect: Effect
  get(): T | undefined
}

export function useSignal<T>(initialValue: T): SignalWithInitialValue<T>
export function useSignal<T>(initialValue?: never): SignalWithoutInitialValue<T>
//A Pub Sub that allows us the get Last Value Cache (LVC) and subscribe to changes via the effect method
export function useSignal<T>(initialValue: T) {
  let store: T = initialValue
  const listeners = new Set<(value?: T) => void>()
  const get = () => store
  // The publisher function that notifies all subscribed listeners with optional value.
  const set = (value: T) => {
    store = value
    for (const cb of listeners) cb(value)
  }
  // Subscribes a trigger and BPEvent to the publisher.
  const effect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    const cb = (detail?: T) => trigger<T>({ type: eventType, detail })
    getLVC && cb(store)
    listeners.add(cb)
    const disconnect = () => {
      listeners.delete(cb)
    }
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  set.effect = effect
  set.get = get
  return set
}

export const useComputed = <T>(
  initialValue: () => T,
  deps: (SignalWithInitialValue<T> | SignalWithoutInitialValue<T>)[],
) => {
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
  const effect: Effect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    if (!listeners.size) disconnectDeps.push(...deps.map((dep) => dep.effect('update', update)))
    const cb = (detail?: T) => trigger<T>({ type: eventType, detail })
    getLVC && cb(get())
    listeners.add(cb)
    const disconnect = () => {
      listeners.delete(cb)
      if (!listeners.size) for (const dep of disconnectDeps) dep()
    }
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  get.effect = effect
  return get
}
