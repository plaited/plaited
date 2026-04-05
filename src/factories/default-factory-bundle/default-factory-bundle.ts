import type { Factory } from '../../agent.ts'
import { createServerFactory } from '../server-factory/server-factory.ts'

/**
 * Identifier for the current shipped bootstrap-time default factory bundle.
 *
 * @public
 */
export const DEFAULT_BOOTSTRAP_FACTORY_BUNDLE_ID = 'minimal-server'

/**
 * Stable factory keys that bootstrap installs from the default bundle.
 *
 * @public
 */
export const DEFAULT_BOOTSTRAP_FACTORY_KEYS = ['server-factory'] as const

/** @public */
export type DefaultBootstrapFactoryKey = (typeof DEFAULT_BOOTSTRAP_FACTORY_KEYS)[number]

/**
 * Creates the smallest real factory bundle the runtime should install at
 * bootstrap time today.
 *
 * @remarks
 * This bundle is intentionally minimal. It installs only the server lane so
 * bootstrap can emit startup config and lifecycle events without turning
 * `src/bootstrap/*` into a policy surface.
 *
 * Additional behavior should be added by evolving `src/factories/*` and then
 * promoting those lanes into this bundle when they are ready.
 *
 * @public
 */
export const createDefaultBootstrapFactories = (): Factory[] => [
  createServerFactory({
    initialConfig: {
      autostart: false,
    },
  }),
]
