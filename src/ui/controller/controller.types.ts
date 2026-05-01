import type { Disconnect, Trigger } from '../../behavioral.ts'
import type { DelegatedListener, delegates } from './delegated-listener.ts'
/**
 * Runtime context passed to default exports from imported controller modules.
 *
 * @remarks
 * The controller validates that a module has a default function, then calls it
 * with this context. Modules can register cleanup callbacks, reuse the
 * delegated listener registry, and send BP events through `trigger`.
 *
 * @public
 */
export type ControllerModuleContext = {
  DelegatedListener: typeof DelegatedListener
  delegates: typeof delegates
  addDisconnect: (disconnect: Disconnect) => void
  trigger: Trigger
}

/**
 * Default export contract for controller modules loaded by `import` messages.
 *
 * @remarks
 * Controller modules run for their side effects. Returning a promise lets the
 * controller report import completion only after asynchronous setup finishes.
 *
 * @public
 */
export type ControllerModuleDefault = (context: ControllerModuleContext) => void | Promise<void>
