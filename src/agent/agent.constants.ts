import { keyMirror } from '../utils.ts'

export const HARNESS_MESSAGE = 'harness_message'

export const WORKER_MESSAGE = 'worker_message'

export const SOCKET_MESSAGE = 'socket_message'

export const INFERENCE = 'inference'

export const WORKER_EVENTS = keyMirror(
  'connect_socket',
  'get_context',
  'heartbeat',
  'prompt',
  'read',
  'setup',
  'shell',
  'update_specs',
  'write',
)

export const WORKER_TO_MODEL_MESSAGE_EVENT = keyMirror(
  `write_response`,
  'read_response',
  'shell_response',
  'update_specs_response',
)

export const MAX_SOCKET_CONNECT_RETRIES = 3

/** @internal WebSocket close codes that warrant reconnect attempts. */
export const SOCKET_RETRY_STATUS_CODES = new Set([1006, 1012, 1013])
