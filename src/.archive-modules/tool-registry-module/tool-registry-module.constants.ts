import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the tool registry module.
 *
 * @public
 */
export const TOOL_REGISTRY_MODULE_EVENTS = keyMirror('tool_registry_updated')

/**
 * Default signal keys used by the tool registry module.
 *
 * @public
 */
export const TOOL_REGISTRY_MODULE_SIGNAL_KEYS = {
  registry: 'tool_registry_catalog',
} as const
