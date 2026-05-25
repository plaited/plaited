/**
 * Types for controller module imports.
 *
 * @remarks
 * Controller islands can import dynamic modules at runtime. Each module must
 * export a default function matching {@link ControllerModule} that receives a
 * {@link ControllerModuleContext} with controller primitives for event wiring,
 * listener delegation, and error reporting.
 *
 * @see {@link ControllerModule}
 * @see {@link ControllerModuleContext}
 */

import type { Disconnect, JsonObject, Trigger } from '../behavioral.ts'
import type { DelegatedListener, delegates } from './delegated-listener.ts'

/**
 * Context object passed to imported controller modules.
 *
 * @remarks
 * Provides the primitives a module needs to wire DOM event listeners, trigger
 * behavioral events, register cleanup callbacks, and report runtime errors back
 * to the agent.
 *
 * @public
 */
export type ControllerModuleContext = {
  /** DelegatedListener constructor for wrapping event callbacks. */
  DelegatedListener: typeof DelegatedListener
  /** WeakMap for storing delegated listeners keyed by their event targets. */
  delegates: typeof delegates
  /** Registers a cleanup callback invoked when the controller disconnects. */
  addDisconnect: (disconnect: Disconnect) => void
  /** Triggers a behavioral event on the controller's topic. */
  trigger: Trigger
  /** Reports a runtime error back to the agent with an optional description and context. */
  reportError: (error: unknown, metadata?: { description?: string; context?: JsonObject }) => void
}

/**
 * Type for the default export expected from a controller module.
 *
 * @remarks
 * Every controller module loaded via `p-import` must have a default export that
 * matches this signature. The setup function receives controller context
 * primitives and returns nothing (synchronous or promise-based).
 *
 * @example
 * ```ts
 * // my-controller-module.ts
 * import type { ControllerModule } from 'plaited/ui'
 *
 * const setup: ControllerModule = ({ DelegatedListener, trigger }) => {
 *   const listener = new DelegatedListener(() => {
 *     trigger({ type: 'my_event', detail: { key: 'value' } })
 *   })
 *   document.getElementById('btn')?.addEventListener('click', listener)
 * }
 *
 * export default setup
 * ```
 *
 * @public
 */
export type ControllerModule = (context: ControllerModuleContext) => void | Promise<void>
