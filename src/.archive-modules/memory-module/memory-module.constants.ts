import { keyMirror } from '../../utils.ts'

export const MEMORY_MODULE_EVENTS = keyMirror('memory_module_updated')

export const MEMORY_MODULE_SIGNAL_KEYS = {
  working: 'memory_module_working',
  episodes: 'memory_module_episodes',
} as const
