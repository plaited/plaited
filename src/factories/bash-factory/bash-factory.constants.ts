import { keyMirror } from '../../utils.ts'

export const BASH_FACTORY_EVENTS = keyMirror('bash_factory_request', 'bash_factory_mark_result', 'bash_factory_updated')

export const BASH_FACTORY_SIGNAL_KEYS = {
  state: 'bash_factory_state',
} as const
