import type { Trigger, Disconnect } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from './plaited.guards.js'

export type Listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean) => Disconnect

type SignalWithInitialValue<T> = {
  set(value: T): void
  listen: Listen
  get(): T
}

type SignalWithoutInitialValue<T> = {
  set(value?: T): void
  listen: Listen
  get(): T | undefined
}

export function useSignal<T>(initialValue: T): SignalWithInitialValue<T>
export function useSignal<T>(initialValue?: never): SignalWithoutInitialValue<T>
//A Pub Sub that allows us the get Last Value Cache (LVC) and subscribe to changes via the listen method
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
  const listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    const cb = (detail?: T) => trigger<T>({ type: eventType, detail })
    getLVC && cb(store)
    listeners.add(cb)
    const disconnect = () => {
      listeners.delete(cb)
    }
    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }
  return {
    get,
    set,
    listen,
  }
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
  const listen: Listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    if (!listeners.size) disconnectDeps.push(...deps.map((dep) => dep.listen('update', update)))
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
  return {
    get,
    listen,
  }
}
