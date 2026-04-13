import { keyMirror } from '../../utils.ts'

export const BASH_MODULE_EVENTS = keyMirror('bash_module_request', 'bash_module_mark_result', 'bash_module_updated')

export const BASH_MODULE_SIGNAL_KEYS = {
  state: 'bash_module_state',
} as const
