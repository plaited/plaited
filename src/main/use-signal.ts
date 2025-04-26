import type { Trigger, Disconnect } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import { isPlaitedTrigger } from './plaited.guards.js'

/**
 * Type definition for signal subscription function.
 * Enables event-based monitoring of signal value changes.
 *
 * @param eventType Event type identifier
 * @param trigger Event trigger function
 * @param getLVC Whether to get last value cache immediately
 * @returns Disconnect function for cleanup
 */
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
/**
 * Creates a reactive signal with state management and subscription capabilities.
 * Supports last value caching and type-safe value updates.
 *
 * @template T Type of signal value
 * @param initialValue Optional initial value for the signal
 * @returns Signal management object
 *
 * Features:
 * - Get/Set value operations
 * - Event-based subscriptions
 * - Last value caching
 * - Type-safe updates
 * - Automatic cleanup
 *
 * @example
 * // Basic usage with event handling
 * const counter = useSignal(0);
 *
 * // Listen for changes with immediate value
 * counter.listen('COUNT_CHANGED', trigger, true);
 *
 * // In component context
 * const Counter = defineElement({
 *   tag: 'my-counter',
 *   bProgram({ trigger }) {
 *     const count = useSignal(0);
 *
 *     // Subscribe to changes
 *     const disconnect = count.listen('COUNT_CHANGED', trigger, true);
 *
 *     return {
 *       INCREMENT: () => count.set(count.get() + 1),
 *       COUNT_CHANGED: (value: number) => console.log('New count:', value),
 *       onDisconnected: () => disconnect()
 *     }
 *   }
 * });
 *
 * @remarks
 * - Provides pub/sub pattern for value changes
 * - Maintains single source of truth
 * - Supports multiple subscribers
 * - Handles cleanup automatically
 */
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
/**
 * Creates a computed signal derived from other signals.
 * Automatically updates when dependencies change.
 *
 * @template T Type of computed value
 * @param initialValue Function that computes the value
 * @param deps Array of signals this computation depends on
 * @returns Readonly signal with computed value
 *
 * Features:
 * - Derived state management
 * - Automatic dependency tracking
 * - Lazy evaluation
 * - Efficient updates
 * - Resource cleanup
 *
 * @example
 * // In component context
 * const Calculator = defineElement({
 *   tag: 'my-calculator',
 *   bProgram({ trigger }) {
 *     const first = useSignal(5);
 *     const second = useSignal(10);
 *
 *     const sum = useComputed(
 *       () => first.get() + second.get(),
 *       [first, second]
 *     );
 *
 *     // Listen for computed changes
 *     const disconnect = sum.listen('SUM_CHANGED', trigger, true);
 *
 *     return {
 *       UPDATE_FIRST: (value: number) => first.set(value),
 *       UPDATE_SECOND: (value: number) => second.set(value),
 *       SUM_CHANGED: (value: number) => console.log('New sum:', value),
 *       onDisconnected: () => disconnect()
 *     }
 *   }
 * });
 *
 * @remarks
 * - Only updates when dependencies change
 * - Lazy initialization of computed value
 * - Manages dependency subscriptions
 * - Cleans up when last listener disconnects
 * - Supports multiple dependent signals
 */
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
