import { keyMirror } from '../utils.ts'

export const AGENT_EVENTS = keyMirror('start', 'worker_start', 'worker_open', 'worker_terminate', 'worker_close')

export const UI_PROJECTION_EVENTS = keyMirror(
  'ui_render_requested',
  'ui_attrs_requested',
  'ui_controller_message_sent',
  'ui_controller_message_error',
  'ui_page_render_requested',
  'ui_page_rendered',
)
