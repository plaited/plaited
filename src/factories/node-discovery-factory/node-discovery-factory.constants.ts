import { keyMirror } from '../../utils.ts'

export const NODE_DISCOVERY_FACTORY_EVENTS = keyMirror(
  'node_discovery_factory_bind_target',
  'node_discovery_factory_publish',
  'node_discovery_factory_updated',
)

export const NODE_DISCOVERY_FACTORY_SIGNAL_KEYS = {
  state: 'node_discovery_factory_state',
} as const
