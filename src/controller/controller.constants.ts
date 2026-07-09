import { keyMirror } from '../utils.ts'

/** @internal WebSocket close codes that warrant reconnect attempts. */
export const UI_CORE_RETRY_STATUS_CODES = new Set([1006, 1012, 1013])

/** @internal Maximum reconnect attempts before a controller island gives up. */
export const UI_CORE_MAX_RETRIES = 3

/**
 * @internal
 * Error name registry mirrored by the `name` field of every controller error
 * class, so the agent can categorize reported errors by stable string key
 * rather than parsing class names.
 */
export const ERROR_TYPES = keyMirror(
  'element_not_found',
  'web_socket_message',
  'trigger',
  'page_extension',
  'web_socket',
  'form_submit',
  'adopt_style_sheet',
)
