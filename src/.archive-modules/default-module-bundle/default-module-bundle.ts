import type { Module } from '../../agent.ts'
import { createServerModule } from '../server-module/server-module.ts'

/**
 * Identifier for the current shipped bootstrap-time default module bundle.
 *
 * @public
 */
export const DEFAULT_BOOTSTRAP_MODULE_BUNDLE_ID = 'minimal-server'

/**
 * Stable module keys that bootstrap installs from the default bundle.
 *
 * @public
 */
export const DEFAULT_BOOTSTRAP_MODULE_KEYS = ['server-module'] as const

/** @public */
export type DefaultBootstrapModuleKey = (typeof DEFAULT_BOOTSTRAP_MODULE_KEYS)[number]

/**
 * Creates the smallest real module bundle the runtime should install at
 * bootstrap time today.
 *
 * @remarks
 * This bundle is intentionally minimal. It installs only the server lane so
 * bootstrap can emit startup config and lifecycle events without turning
 * `src/bootstrap/*` into a policy surface.
 *
 * Additional behavior should be added by evolving `src/modules/*` and then
 * promoting those lanes into this bundle when they are ready.
 *
 * @public
 */
export const createDefaultBootstrapModules = (): Module[] => [
  createServerModule({
    initialConfig: {
      autostart: false,
    },
  }),
]
