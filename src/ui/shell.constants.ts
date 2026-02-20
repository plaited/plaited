import { keyMirror } from '../utils.ts'

export const SHELL_EVENTS = keyMirror(
  'user_action',
  'web_socket_error',
  'render',
  'rendered',
  'attrs',
  'stream',
  'disconnect',
)

export const SWAP_MODES = keyMirror('afterend', 'afterbegin', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

export const CONSOLE_ERRORS = keyMirror(
  'attrs_element_not_found',
  'stream_element_not_found',
  'ws_invalid_message',
  'ws_error_message',
)
