import { keyMirror } from '../../utils.ts'

export const ACP_FACTORY_EVENTS = keyMirror(
  'acp_factory_open_session',
  'acp_factory_submit_turn',
  'acp_factory_cancel_session',
  'acp_factory_updated',
)

export const ACP_FACTORY_SIGNAL_KEYS = {
  state: 'acp_factory_state',
} as const
