import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the tool registry factory.
 *
 * @public
 */
export const TOOL_REGISTRY_FACTORY_EVENTS = keyMirror('tool_registry_updated')

/**
 * Default signal keys used by the tool registry factory.
 *
 * @public
 */
export const TOOL_REGISTRY_FACTORY_SIGNAL_KEYS = {
  registry: 'tool_registry_catalog',
} as const
