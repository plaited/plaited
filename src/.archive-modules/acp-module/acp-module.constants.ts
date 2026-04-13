import { keyMirror } from '../../utils.ts'

export const ACP_MODULE_EVENTS = keyMirror(
  'acp_module_open_session',
  'acp_module_submit_turn',
  'acp_module_cancel_session',
  'acp_module_updated',
)

export const ACP_MODULE_SIGNAL_KEYS = {
  state: 'acp_module_state',
} as const
