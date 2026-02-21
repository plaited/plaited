import { keyMirror } from '../utils.ts'

export const CONTROLLER_EVENTS = keyMirror(
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
  //Document lifecycle
  'on_pagereveal',
  'on_pageswap',
)

export const ALLOWED_EVENTS = [
  CONTROLLER_EVENTS.attrs,
  CONTROLLER_EVENTS.disconnect,
  CONTROLLER_EVENTS.render,
  CONTROLLER_EVENTS.stream,
  CONTROLLER_EVENTS.update_behavioral,
] as const

export const SWAP_MODES = keyMirror('afterbegin', 'afterend', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

export const CONSOLE_ERRORS = keyMirror(
  `${CONTROLLER_EVENTS.attrs}_element_not_found`,
  `${CONTROLLER_EVENTS.stream}_element_not_found`,
  `${CONTROLLER_EVENTS.update_behavioral}_error`,
  `${CONTROLLER_EVENTS.update_behavioral}_invalid_b_thread`,
  'ws_error_message',
  'ws_invalid_message',
)
