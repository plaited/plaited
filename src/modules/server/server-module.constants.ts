import { BRIDGE_SERVER_MODULE_ID } from '../../bridge-events.ts'
import { keyMirror } from '../../utils.ts'

export const SERVER_MODULE_ID = BRIDGE_SERVER_MODULE_ID

export const SERVER_MODULE_EVENTS = keyMirror(
  'server_start',
  'server_stop',
  'server_send',
  'server_started',
  'server_stopped',
  'server_error',
  'client_connected',
  'client_disconnected',
  'client_error',
)

export const SERVER_MODULE_ERROR_CODES = keyMirror(
  'origin_rejected',
  'connection_rejected',
  'upgrade_failed',
  'malformed_message',
  'protocol_missing',
  'not_found',
  'internal_error',
  'server_not_running',
)

export const SERVER_MODULE_WEBSOCKET_PATH = '/ws'

export const DEFAULT_CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"

export const toServerModuleEventType = <TEvent extends string>(event: TEvent): `${typeof SERVER_MODULE_ID}:${TEvent}` =>
  `${SERVER_MODULE_ID}:${event}`
