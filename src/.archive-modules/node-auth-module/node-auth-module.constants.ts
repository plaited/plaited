import { keyMirror } from '../../utils.ts'

export const NODE_AUTH_MODULE_EVENTS = keyMirror(
  'node_auth_module_set_mode',
  'node_auth_module_authenticate',
  'node_auth_module_clear_session',
  'node_auth_module_updated',
)

export const NODE_AUTH_MODULE_SIGNAL_KEYS = {
  state: 'node_auth_module_state',
} as const
