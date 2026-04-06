import { keyMirror } from '../../utils.ts'

export const NODE_AUTH_FACTORY_EVENTS = keyMirror(
  'node_auth_factory_set_mode',
  'node_auth_factory_authenticate',
  'node_auth_factory_clear_session',
  'node_auth_factory_updated',
)

export const NODE_AUTH_FACTORY_SIGNAL_KEYS = {
  state: 'node_auth_factory_state',
} as const
