import { keyMirror } from '../utils.ts'

export const SHELL_EVENTS = keyMirror(
  // Server → Client
  'attrs',
  'disconnect',
  'render',
  'stream',
  'update_behavioral',
  // Client → Server
  'behavioral_updated',
  'root_connected',
  'user_action',
  'snapshot',
  // WebSocket lifecycle
  'connect',
  'retry',
  'on_ws_error',
  'on_ws_message',
  'on_ws_open',
)

export const ALLOWED_EVENTS = [
  SHELL_EVENTS.attrs,
  SHELL_EVENTS.disconnect,
  SHELL_EVENTS.render,
  SHELL_EVENTS.stream,
  SHELL_EVENTS.update_behavioral,
] as const

export const SWAP_MODES = keyMirror('afterbegin', 'afterend', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

export const CONSOLE_ERRORS = keyMirror(
  `${SHELL_EVENTS.attrs}_element_not_found`,
  `${SHELL_EVENTS.stream}_element_not_found`,
  `${SHELL_EVENTS.update_behavioral}_error`,
  `${SHELL_EVENTS.update_behavioral}_invalid_b_thread`,
  'ws_error_message',
  'ws_invalid_message',
)
