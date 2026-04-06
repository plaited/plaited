import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the observability factory.
 *
 * @public
 */
export const OBSERVABILITY_FACTORY_EVENTS = keyMirror('observability_factory_updated')

/**
 * Default signal keys used by the observability factory.
 *
 * @public
 */
export const OBSERVABILITY_FACTORY_SIGNAL_KEYS = {
  traces: 'observability_factory_traces',
} as const
