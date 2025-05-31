import type { Trigger, Disconnect } from '../behavioral/b-program.js'

/**
 * An enhanced `Trigger` type specifically for Plaited components or contexts.
 * It extends the standard `Trigger` by adding a method (`addDisconnectCallback`)
 * to associate cleanup functions (`Disconnect`) with the trigger's lifecycle.
 * This allows resources or subscriptions initiated via the trigger's context
 * to be properly cleaned up when the context is destroyed.
 *
 * @property addDisconnectCallback - A function to register a cleanup callback that should be
 *   executed when the component or context associated with this trigger is disconnected
 */
export type PlaitedTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}
/**
 * Augments a standard `Trigger` function with the ability to register disconnect callbacks.
 * This function takes a base `Trigger` and a `Set` intended to hold `Disconnect` functions.
 * It adds the `addDisconnectCallback` method to the trigger, which allows consumers
 * to add their cleanup logic (e.g., unsubscribing from listeners, clearing timeouts)
 * to the provided `disconnectSet`.
 *
 * @param trigger - The base `Trigger` function obtained from `bProgram()`
 * @param disconnectSet - A `Set` instance where registered `Disconnect` callbacks will be stored
 * @returns The original `trigger` function, augmented with the `addDisconnectCallback` method
 *
 * @example
 * ```ts
 * const baseTrigger = bProgram().trigger;
 * const cleanupCallbacks = new Set<Disconnect>();
 *
 * // Create the enhanced trigger
 * const plaitedTrigger = getPlaitedTrigger(baseTrigger, cleanupCallbacks);
 *
 * // Somewhere else, a listener is set up, and its cleanup is registered
 * const listenerCleanup = someEventEmitter.subscribe(() => {});
 * plaitedTrigger.addDisconnectCallback(listenerCleanup);
 *
 * // Later, during component teardown:
 * // cleanupCallbacks.forEach(cb => cb());
 * ```
 */
export const getPlaitedTrigger = (trigger: Trigger, disconnectSet: Set<Disconnect>) => {
  Object.assign(trigger, {
    addDisconnectCallback: (cb: Disconnect) => disconnectSet.add(cb),
  })
  return trigger as PlaitedTrigger
}

/**
 * Type guard to identify enhanced Plaited triggers with disconnect capability.
 * Used internally by the framework to ensure proper cleanup of component resources.
 *
 * @param trigger - The trigger function to check
 * @returns True if the trigger includes disconnect callback support
 *
 * @example Using in a custom effect implementation
 * ```tsx
 * const useCustomEffect = (trigger: Trigger | PlaitedTrigger, callback: () => () => void) => {
 *   if (isPlaitedTrigger(trigger)) {
 *     const cleanup = callback();
 *     // Register cleanup function to run on component disconnect
 *     trigger.addDisconnectCallback(cleanup);
 *   }
 * };
 *
 * // Usage in a component
 * const MyComponent = defineElement({
 *   tag: 'my-component',
 *   shadowDom: <div p-target="root" />,
 *   bProgram({ trigger }) {
 *     useCustomEffect(trigger, () => {
 *       const interval = setInterval(() => console.log('tick'), 1000);
 *       return () => clearInterval(interval);
 *     });
 *   }
 * });
 * ```
 */
export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger =>
  Object.hasOwn(trigger, 'addDisconnectCallback')
