import { keyMirror } from '../utils.ts'

export const CONTROLLER_EVENTS = keyMirror(
  // Server → Client
  'attrs',
  'disconnect',
  'render',
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

export const RESTRICTED_EVENTS = keyMirror(
  // Client → Server
  CONTROLLER_EVENTS.behavioral_updated,
  CONTROLLER_EVENTS.root_connected,
  CONTROLLER_EVENTS.user_action,
  CONTROLLER_EVENTS.snapshot,
  // WebSocket lifecycle
  CONTROLLER_EVENTS.connect,
  CONTROLLER_EVENTS.retry,
  CONTROLLER_EVENTS.on_ws_error,
  CONTROLLER_EVENTS.on_ws_message,
  CONTROLLER_EVENTS.on_ws_open,
)

export const SWAP_MODES = keyMirror('afterbegin', 'afterend', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

export const CONTROLLER_ERRORS = keyMirror(`${CONTROLLER_EVENTS.attrs}_element_not_found`)
