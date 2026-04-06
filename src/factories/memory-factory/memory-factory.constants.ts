import { keyMirror } from '../../utils.ts'

export const MEMORY_FACTORY_EVENTS = keyMirror('memory_factory_updated')

export const MEMORY_FACTORY_SIGNAL_KEYS = {
  working: 'memory_factory_working',
  episodes: 'memory_factory_episodes',
} as const
