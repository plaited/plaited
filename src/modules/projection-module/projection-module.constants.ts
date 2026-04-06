import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the projection module.
 *
 * @public
 */
export const PROJECTION_MODULE_EVENTS = keyMirror('projection_module_updated')

/**
 * Default signal keys used by the projection module.
 *
 * @public
 */
export const PROJECTION_MODULE_SIGNAL_KEYS = {
  phase: 'projection_module_phase',
  blocks: 'projection_module_blocks',
} as const
