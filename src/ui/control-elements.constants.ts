import { keyMirror } from '../utils.ts'

export const ELEMENT_CALLBACKS = keyMirror(
  'on_adopted',
  'on_attribute_changed',
  'on_connected',
  'on_disconnected',
  'on_form_associated',
  'on_form_disabled',
  'on_form_reset',
  'on_form_state_restore',
)
