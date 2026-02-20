import { keyMirror } from '../utils.ts'

export const SHELL_EVENTS = keyMirror(
  'user_action',
  'web_socket_error',
  'render',
  'rendered',
  'attrs',
  'stream',
  'disconnect',
  'add_b_threads',
  'b_threads_added',
)

export const SWAP_MODES = keyMirror('afterend', 'afterbegin', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

export const CONSOLE_ERRORS = keyMirror(
  `${SHELL_EVENTS.attrs}_element_not_found`,
  `${SHELL_EVENTS.stream}_element_not_found`,
  'ws_invalid_message',
  'ws_error_message',
  `${SHELL_EVENTS.add_b_threads}_invalid_b_thread`,
  `${SHELL_EVENTS.add_b_threads}_error`,
)
