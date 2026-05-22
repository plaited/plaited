import { keyMirror } from '../utils.ts'

export const AGENT_EVENTS = keyMirror('start')

export const DEFAULT_POLICY = {
  temperature: 1.0,
  topP: 0.95,
  topK: 64,
  maxCompletionTokens: 1024,
}

export const UI_PROJECTION_EVENTS = keyMirror(
  'ui_render_requested',
  'ui_attrs_requested',
  'ui_controller_message_sent',
  'ui_controller_message_error',
  'ui_page_render_requested',
  'ui_page_rendered',
)
