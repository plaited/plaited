/**
 * @internal
 * @module use-signal
 *
 * Purpose: Reactive state management system for cross-component communication in Plaited
 * Architecture: Implements pub/sub pattern with automatic cleanup and computed values
 * Dependencies: b-program for triggers, get-plaited-trigger for lifecycle integration
 * Consumers: Components needing shared state, computed values, or reactive data flow
 *
 * Maintainer Notes:
 * - Signals are the primary state sharing mechanism between Plaited components
 * - Two signal types: with/without initial value for different use cases
 * - Computed signals provide lazy evaluation with automatic dependency tracking
 * - All subscriptions are automatically cleaned up via PlaitedTrigger integration
 * - getLVC (get Last Value on Connect) enables immediate state synchronization
 * - Signals are intentionally kept simple - no batching or async updates
 *
 * Common modification scenarios:
 * - Adding signal batching: Wrap set() calls in microtask queue
 * - Supporting async computeds: Change initialValue to return Promise<T>
 * - Adding signal middleware: Insert transformation layer in set()
 * - Performance monitoring: Track listener count and update frequency
 *
 * Performance considerations:
 * - O(n) notification where n is listener count - keep subscriptions minimal
 * - Computed values are lazy - only calculated when accessed
 * - No memoization of computed values - recalculated on each dependency change
 * - Set operations are synchronous - may cause cascading updates
 *
 * Known limitations:
 * - No built-in circular dependency detection
 * - No transaction support for multiple signal updates
 * - Computed signals can't be directly set
 * - No persistence layer integration
 */
import type {
  Trigger,
  Disconnect,
  PlaitedTrigger,
  Listen,
  SignalWithInitialValue,
  SignalWithoutInitialValue,
} from './behavioral.types.js'
import { isPlaitedTrigger } from './behavioral.utils.js'

export function useSignal<T>(initialValue: T): SignalWithInitialValue<T>
export function useSignal<T>(initialValue?: never): SignalWithoutInitialValue<T>
/**
 * Creates a reactive signal for state management in Plaited components.
 * Provides a pub/sub pattern for sharing state between components with automatic cleanup.
 *
 * @template T Type of signal value
 * @param initialValue Optional initial value for the signal
 * @returns Signal management object with get/set/listen methods
 *
 * @example Shared state between components
 * ```tsx
 * // Create a shared cart state
 * const cartState = useSignal<CartItem[]>([]);
 *
 * const AddToCart = bElement({
 *   tag: 'add-to-cart',
 *   shadowDom: (
 *     <button
 *       p-target="addBtn"
 *       p-trigger={{ click: 'ADD_ITEM' }}
 *     >
 *       Add to Cart
 *     </button>
 *   ),
 *   bProgram({ trigger }) {
 *     return {
 *       ADD_ITEM() {
 *         const currentCart = cartState.get();
 *         cartState.set([...currentCart, { id: 'new-item', qty: 1 }]);
 *       }
 *     };
 *   }
 * });
 *
 * const CartCount = bElement({
 *   tag: 'cart-count',
 *   shadowDom: (
 *     <div>
 *       <span p-target="count">0</span> items
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [count] = $('count');
 *
 *     // Subscribe to cart changes with immediate value
 *     cartState.listen('CART_UPDATED', trigger, true);
 *
 *     return {
 *       CART_UPDATED(items: CartItem[]) {
 *         count.render(items.length.toString());
 *       }
 *     };
 *   }
 * });
 * ```
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
     * Auto-cleanup integration with component lifecycle.
     * Ensures subscriptions don't outlive their components.
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
 * Perfect for derived state in Plaited components.
 *
 * @template T Type of computed value
 * @param initialValue Function that computes the derived value
 * @param deps Array of signals this computation depends on
 * @returns A readonly signal-like object with `get` and `listen` methods. The `get` method returns the computed value,
 *          and `listen` allows subscribing to changes in the computed value. This signal does not have a `set` method.
 *
 * @example Price calculator component
 * ```tsx
 * const PriceCalculator = bElement({
 *   tag: 'price-calculator',
 *   shadowDom: (
 *     <div>
 *       <div>
 *         Quantity:
 *         <input
 *           type="number"
 *           p-target="qty"
 *           p-trigger={{ input: 'UPDATE_QTY' }}
 *           value="1"
 *         />
 *       </div>
 *       <div>
 *         Unit Price:
 *         <input
 *           type="number"
 *           p-target="price"
 *           p-trigger={{ input: 'UPDATE_PRICE' }}
 *           value="10.00"
 *         />
 *       </div>
 *       <div>Total: <span p-target="total">$10.00</span></div>
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [qtyInput] = $<HTMLInputElement>('qty');
 *     const [priceInput] = $<HTMLInputElement>('price');
 *     const [total] = $('total');
 *
 *     const quantity = useSignal(1);
 *     const unitPrice = useSignal(10.00);
 *
 *     // Computed total that updates when quantity or price changes
 *     const totalPrice = useComputed(
 *       () => quantity.get() * unitPrice.get(),
 *       [quantity, unitPrice]
 *     );
 *
 *     // Listen for total changes
 *     totalPrice.listen('TOTAL_CHANGED', trigger, true);
 *
 *     return {
 *       UPDATE_QTY() {
 *         quantity.set(Number(qtyInput.value) || 0);
 *       },
 *
 *       UPDATE_PRICE() {
 *         unitPrice.set(Number(priceInput.value) || 0);
 *       },
 *
 *       TOTAL_CHANGED(value: number) {
 *         total.render(`$${value.toFixed(2)}`);
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * - Computed values are lazy - only calculated when needed
 * - Dependencies are tracked automatically
 * - Clean up is handled automatically
 * - Perfect for derived state like:
 *   - Filtered lists
 *   - Total calculations
 *   - Form validation
 *   - Data transformations
 */
export const useComputed = <T>(
  initialValue: () => T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
