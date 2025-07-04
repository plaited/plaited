import type { Trigger, Disconnect } from './b-program.js'
import { type PlaitedTrigger, isPlaitedTrigger } from './get-plaited-trigger.js'

/**
 * Type definition for signal subscription function.
 * Enables event-based monitoring of signal value changes.
 *
 * @param eventType Event type identifier for the triggered event
 * @param trigger Component's trigger function for handling value changes
 * @param getLVC Whether to immediately trigger with current value
 * @returns Cleanup function for removing the subscription
 */
export type Listen = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean) => Disconnect

export type SignalWithInitialValue<T> = {
  set(value: T): void
  listen: Listen
  get(): T
}

export type SignalWithoutInitialValue<T> = {
  set(value?: T): void
  listen: Listen
  get(): T | undefined
}

export type Signal<T> = SignalWithInitialValue<T> | SignalWithoutInitialValue<T>

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
 * const AddToCart = defineElement({
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
 * const CartCount = defineElement({
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
    const cb = (detail?: T) => trigger({ type: eventType, detail })
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
 * Creates a computed signal that automatically updates based on dependencies.
 * Perfect for derived state in Plaited components.
 *
 * @template T Type of computed value
 * @param initialValue Function that computes the derived value
 * @param deps Array of signals this computation depends on
 * @returns Readonly signal with computed value
 *
 * @example Price calculator component
 * ```tsx
 * const PriceCalculator = defineElement({
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
    const cb = (detail?: T) => trigger({ type: eventType, detail })
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
