import { keyMirror } from '../../utils.ts'

export const EDIT_MODULE_EVENTS = keyMirror(
  'edit_module_request',
  'edit_module_apply',
  'edit_module_mark_ready',
  'edit_module_mark_repair',
  'edit_module_updated',
)

export const EDIT_MODULE_SIGNAL_KEYS = {
  state: 'edit_module_state',
} as const
