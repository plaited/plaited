import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the observability module.
 *
 * @public
 */
export const OBSERVABILITY_MODULE_EVENTS = keyMirror('observability_module_updated')

/**
 * Default signal keys used by the observability module.
 *
 * @public
 */
export const OBSERVABILITY_MODULE_SIGNAL_KEYS = {
  traces: 'observability_module_traces',
} as const
