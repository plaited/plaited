import { keyMirror } from '../utils.ts'

export const SHELL_EVENTS = keyMirror(
  'user_action',
  'web_socket_error',
  'render',
  'rendered',
  'attrs',
  'stream',
  'attrs_element_not_found',
  'stream_element_not_found',
  'disconnect',
)
