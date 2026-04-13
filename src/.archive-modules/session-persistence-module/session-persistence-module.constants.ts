import { keyMirror } from '../../utils.ts'

export const SESSION_PERSISTENCE_MODULE_EVENTS = keyMirror('session_persistence_module_updated')

export const SESSION_PERSISTENCE_MODULE_SIGNAL_KEYS = {
  state: 'session_persistence_module_state',
} as const
