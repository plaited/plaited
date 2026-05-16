import { keyMirror } from '../utils.ts'

/**
 * UI projection journal event names exposed for agents and schema consumers.
 *
 * @remarks
 * These event names use underscores so TypeScript callers can use normal
 * property access while still getting keyMirror typo protection.
 *
 * @public
 */
export const UI_PROJECTION_EVENTS = keyMirror(
  'ui_render_requested',
  'ui_attrs_requested',
  'ui_controller_message_sent',
  'ui_controller_message_error',
  'ui_page_render_requested',
  'ui_page_rendered',
)
