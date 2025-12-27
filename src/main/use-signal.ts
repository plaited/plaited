/**
 * @internal
 * Reactive state management for cross-island communication in Plaited.
 * Provides signals with pub/sub pattern and automatic cleanup integration.
 */
import type {
  Disconnect,
  Listen,
  PlaitedTrigger,
  SignalWithInitialValue,
  SignalWithoutInitialValue,
  Trigger,
} from './behavioral.types.ts'
import { isPlaitedTrigger } from './behavioral.utils.ts'

export function useSignal<T>(initialValue: T): SignalWithInitialValue<T>
export function useSignal<T>(initialValue?: never): SignalWithoutInitialValue<T>
/**
 * Creates a reactive signal for state management in BehavioralElements.
 * Provides a pub/sub pattern for sharing state between BehavioralElements with automatic cleanup.
 *
 * @template T Type of signal value
 * @param initialValue Optional initial value for the signal
 * @returns Signal management object with get/set/listen methods
 *
 * @remarks
 * **Cross-Island Communication:**
 * - Signals enable communication between islands not in a direct parent-child relationship
 * - Use normal event flow (trigger/emit) for parent-child communication within shadowDOM
 * - Supports both reading and writing shared state across disconnected template hierarchies
 *
 * **Signal Methods:**
 * - `get()`: Returns current signal value
 * - `set(value)`: Updates signal and notifies all listeners synchronously
 * - `listen(eventType, trigger, getLVC?)`: Subscribes to changes; getLVC=true sends current value immediately
 *
 * **Automatic Cleanup:**
 * - Subscriptions auto-cleanup when custom element disconnects via PlaitedTrigger integration
 * - Manual cleanup via returned disconnect function if needed
 *
 * @see {@link useComputed} for derived state based on signal dependencies
 * @see {@link usePlaitedTrigger} for automatic cleanup integration
 */
export function useSignal<T>(initialValue: T) {
  /**
   * @internal
   * Mutable store for the signal's current value.
   * Direct mutation is intentional for performance.
   */
  let store: T = initialValue

  /**
   * @internal
   * Set of listener callbacks to notify on value changes.
   * Using Set for O(1) add/remove and automatic deduplication.
   */
  const listeners = new Set<(value?: T) => void>()

  /**
   * @internal
   * Getter provides read access to current value.
   * No cloning for performance - consumers must not mutate.
   */
  const get = () => store

  /**
   * @internal
   * Updates store and synchronously notifies all listeners.
   * No equality check - all listeners notified even if value unchanged.
   * This enables force updates and simplifies implementation.
   */
  const set = (value: T) => {
    store = value
    for (const cb of listeners) cb(value)
  }

  /**
   * @internal
   * Creates subscription between signal and behavioral program trigger.
   * Wraps trigger in callback that formats signal value as BPEvent.
   * getLVC enables immediate notification with current value on subscribe.
   */
  const listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    const cb = (detail?: T) => trigger({ type: eventType, detail })
    getLVC && cb(store)
    listeners.add(cb)

    /**
     * @internal
     * Manual cleanup function removes listener from set.
     * Also registered with PlaitedTrigger for automatic cleanup.
     */
    const disconnect = () => {
      listeners.delete(cb)
    }

    /**
     * @internal
     * Auto-cleanup integration with custom element lifecycle.
     * Ensures subscriptions don't outlive their elements.
     */
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
 * Creates a computed signal that automatically updates based on dependencies.
 * Perfect for derived state in BehavioralElements.
 *
 * @template T Type of computed value
 * @param initialValue Function that computes the derived value
 * @param deps Array of signals this computation depends on
 * @returns A readonly signal-like object with `get` and `listen` methods. The `get` method returns the computed value,
 *          and `listen` allows subscribing to changes in the computed value. This signal does not have a `set` method.
 *
 * @remarks
 * **Lazy Evaluation:**
 * - Computed values are only calculated when accessed via `get()`
 * - Recalculated synchronously when any dependency changes
 * - No memoization between dependency changes
 *
 * **Dependency Tracking:**
 * - Dependencies only monitored when at least one listener exists
 * - Automatically subscribes to all dependency signals
 * - Cleanup happens when last listener unsubscribes
 *
 * **Common Use Cases:**
 * - Filtered lists based on search/filter signals
 * - Calculated totals from multiple numeric signals
 * - Form validation states derived from field signals
 * - Data transformations combining multiple sources
 *
 * **Performance:**
 * - O(n) notification where n is listener count
 * - Synchronous updates may cause cascading computations
 * - Unused computeds have zero overhead (no active subscriptions)
 *
 * @see {@link useSignal} for creating source signals
 * @see {@link usePlaitedTrigger} for automatic cleanup
 */
export const useComputed = <T>(
  initialValue: () => T,
  // biome-ignore lint/suspicious/noExplicitAny: Dependency signals can have any value type
  deps: (SignalWithInitialValue<any> | SignalWithoutInitialValue<any>)[],
) => {
  /**
   * @internal
   * Cached computed value, lazily initialized on first access.
   * Undefined until first get() call for true lazy evaluation.
   */
  let store: T

  /**
   * @internal
   * Listeners for this computed signal's changes.
   * Only active when there are subscribers to avoid unnecessary computation.
   */
  const listeners = new Set<(value?: T) => void>()

  /**
   * @internal
   * Lazy getter that computes value on first access.
   * Subsequent calls return cached value until dependencies change.
   */
  const get = () => {
    if (!store) store = initialValue()
    return store
  }

  /**
   * @internal
   * Cleanup functions for dependency subscriptions.
   * Populated when first listener subscribes, cleared when last unsubscribes.
   */
  const disconnectDeps: Disconnect[] = []

  /**
   * @internal
   * Update trigger called when any dependency changes.
   * Recomputes value and notifies all listeners synchronously.
   * Args ignored since we don't care which dependency changed.
   */
  const update: Trigger = (..._) => {
    store = initialValue()
    for (const cb of listeners) cb(store)
  }

  /**
   * @internal
   * Subscribe to computed value changes with lazy dependency tracking.
   * Dependencies only monitored when at least one listener exists.
   * This optimization prevents unnecessary computation for unused computeds.
   */
  const listen: Listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC = false) => {
    /**
     * @internal
     * First listener triggers dependency subscriptions.
     * Uses internal 'update' event type for dependency tracking.
     */
    if (!listeners.size) disconnectDeps.push(...deps.map((dep) => dep.listen('update', update)))

    const cb = (detail?: T) => trigger({ type: eventType, detail })
    getLVC && cb(get())
    listeners.add(cb)

    /**
     * @internal
     * Cleanup unsubscribes from dependencies when last listener removed.
     * This prevents memory leaks and unnecessary computations.
     */
    const disconnect = () => {
      listeners.delete(cb)
      if (!listeners.size) for (const dep of disconnectDeps) void dep()
    }

    isPlaitedTrigger(trigger) && trigger.addDisconnectCallback(disconnect)
    return disconnect
  }

  return {
    get,
    listen,
  }
}
