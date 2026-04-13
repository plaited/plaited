import { keyMirror } from '../../utils.ts'

export const A2A_MODULE_EVENTS = keyMirror(
  'a2a_module_receive_message',
  'a2a_module_register_peer',
  'a2a_module_complete_task',
  'a2a_module_updated',
)

export const A2A_MODULE_SIGNAL_KEYS = {
  state: 'a2a_module_state',
} as const
