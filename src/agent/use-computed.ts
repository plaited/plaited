import type { Disconnect, Trigger } from '../behavioral/behavioral.types.ts'
import type { Listen, Signal } from './agent.types.ts'

export const useComputed =
  (disconnectSet: Set<Disconnect>) =>
  <T>(compute: () => T, deps: Signal[]) => {
    let store: T
    const listeners = new Set<(value?: T) => void>()
    const disconnectDeps: Disconnect[] = []

    const get = () => {
      if (!store) store = compute()
      return store
    }

    const update: Trigger = (..._) => {
      store = compute()
      for (const cb of listeners) cb(store)
    }

    const listen: Listen = ({ eventType, trigger, getLVC = false, disconnectSet: listenerDisconnectSet }) => {
      if (!listeners.size) {
        disconnectDeps.push(
          ...deps.map((dep) =>
            dep.listen({
              eventType: 'update',
              trigger: update,
              disconnectSet,
            }),
          ),
        )
      }

      const cb = (detail?: T) => trigger({ type: eventType, detail })
      getLVC && cb(get())
      listeners.add(cb)

      const disconnect = () => {
        listeners.delete(cb)
        if (!listeners.size) for (const dep of disconnectDeps) void dep()
      }

      listenerDisconnectSet.add(disconnect)
      return disconnect
    }

    return {
      get,
      listen,
    }
  }
