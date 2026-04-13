import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the module discovery module.
 *
 * @public
 */
export const MODULE_DISCOVERY_MODULE_EVENTS = keyMirror(
  'module_discovery_reload',
  'module_discovery_catalog_updated',
  'module_discovery_catalog_failed',
  'module_discovery_load',
  'module_discovery_load_failed',
)

/**
 * Default signal keys used by the module discovery module.
 *
 * @public
 */
export const MODULE_DISCOVERY_MODULE_SIGNAL_KEYS = {
  catalog: 'module_discovery_catalog',
} as const
