import { keyMirror } from '../../utils.ts'

export const FANOUT_MODULE_EVENTS = keyMirror(
  'fanout_module_start',
  'fanout_module_attempt_update',
  'fanout_module_select_winner',
  'fanout_module_updated',
)

export const FANOUT_MODULE_SIGNAL_KEYS = {
  state: 'fanout_module_state',
} as const
