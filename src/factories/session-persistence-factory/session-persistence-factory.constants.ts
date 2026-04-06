import { keyMirror } from '../../utils.ts'

export const SESSION_PERSISTENCE_FACTORY_EVENTS = keyMirror('session_persistence_factory_updated')

export const SESSION_PERSISTENCE_FACTORY_SIGNAL_KEYS = {
  state: 'session_persistence_factory_state',
} as const
