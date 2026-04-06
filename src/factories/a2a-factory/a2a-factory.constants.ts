import { keyMirror } from '../../utils.ts'

export const A2A_FACTORY_EVENTS = keyMirror(
  'a2a_factory_receive_message',
  'a2a_factory_register_peer',
  'a2a_factory_complete_task',
  'a2a_factory_updated',
)

export const A2A_FACTORY_SIGNAL_KEYS = {
  state: 'a2a_factory_state',
} as const
