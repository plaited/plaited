import { keyMirror } from '../../utils.ts'

export const FANOUT_FACTORY_EVENTS = keyMirror(
  'fanout_factory_start',
  'fanout_factory_attempt_update',
  'fanout_factory_select_winner',
  'fanout_factory_updated',
)

export const FANOUT_FACTORY_SIGNAL_KEYS = {
  state: 'fanout_factory_state',
} as const
