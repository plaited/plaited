import { keyMirror } from '../../utils.ts'

export const NODE_HOME_MODULE_EVENTS = keyMirror(
  'node_home_module_checkpoint',
  'node_home_module_export',
  'node_home_module_import',
  'node_home_module_handoff',
  'node_home_module_restore',
  'node_home_module_updated',
)

export const NODE_HOME_MODULE_SIGNAL_KEYS = {
  state: 'node_home_module_state',
} as const
