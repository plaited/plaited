import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the projection factory.
 *
 * @public
 */
export const PROJECTION_FACTORY_EVENTS = keyMirror('projection_factory_updated')

/**
 * Default signal keys used by the projection factory.
 *
 * @public
 */
export const PROJECTION_FACTORY_SIGNAL_KEYS = {
  phase: 'projection_factory_phase',
  blocks: 'projection_factory_blocks',
} as const
