import { keyMirror } from '../../utils.ts'

export const NODE_DISCOVERY_MODULE_EVENTS = keyMirror(
  'node_discovery_module_bind_target',
  'node_discovery_module_publish',
  'node_discovery_module_updated',
)

export const NODE_DISCOVERY_MODULE_SIGNAL_KEYS = {
  state: 'node_discovery_module_state',
} as const
