import { keyMirror } from '../../utils.ts'

export const EDIT_FACTORY_EVENTS = keyMirror(
  'edit_factory_request',
  'edit_factory_apply',
  'edit_factory_mark_ready',
  'edit_factory_mark_repair',
  'edit_factory_updated',
)

export const EDIT_FACTORY_SIGNAL_KEYS = {
  state: 'edit_factory_state',
} as const
