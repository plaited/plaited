import { keyMirror } from '../../utils.ts'

export const NODE_HOME_FACTORY_EVENTS = keyMirror(
  'node_home_factory_checkpoint',
  'node_home_factory_export',
  'node_home_factory_import',
  'node_home_factory_handoff',
  'node_home_factory_restore',
  'node_home_factory_updated',
)

export const NODE_HOME_FACTORY_SIGNAL_KEYS = {
  state: 'node_home_factory_state',
} as const
