import type { Disconnect, Trigger } from '../behavioral/behavioral.types.ts'
import { isTypeOf } from '../utils.ts'
import type { Computed, Listen, Signal } from './agent.types.ts'

/**
 * Creates computed signals backed by one or more source signals.
 *
 * @param disconnectSet - Shared disconnect registry for the owning agent scope.
 * @param trigger - Behavioral trigger used when listeners subscribe by event name.
 * @returns Factory that derives lazily-computed readonly signals from dependencies.
 *
 * @public
 */
export const useComputed =
  (disconnectSet: Set<Disconnect>, trigger: Trigger): Computed =>
  <T>(compute: () => T, deps: Signal[]) => {
    let store: T
    let hasStore = false
    const listeners = new Set<(value?: T) => void>()
    const disconnectDeps: Disconnect[] = []

    const get = () => {
      if (!hasStore) {
        store = compute()
        hasStore = true
      }
      return store
    }

    const update = () => {
      store = compute()
      hasStore = true
      for (const cb of listeners) cb(store)
    }

    const listen: Listen = (eventType, getLVC) => {
      if (!listeners.size) {
        disconnectDeps.push(...deps.map((dep) => dep.listen(update)))
      }

      const cb = (detail?: T) =>
        isTypeOf<string>(eventType, 'string') ? trigger({ type: eventType, detail }) : eventType()
      getLVC && cb(get())
      listeners.add(cb)

      const disconnect = () => {
        listeners.delete(cb)
        if (!listeners.size) {
          for (const dep of disconnectDeps) void dep()
          disconnectDeps.length = 0
        }
      }

      disconnectSet.add(disconnect)
      return disconnect
    }

    return {
      get,
      listen,
    }
  }
