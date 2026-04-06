import { keyMirror } from '../../utils.ts'

/**
 * Server-to-controller protocol event keys emitted by the UI adapter layer.
 *
 * @public
 */
export const AGENT_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'disconnect', 'render', 'update_behavioral')

/**
 * UI adapter lifecycle event keys emitted around client connection handling.
 *
 * @public
 */
export const UI_ADAPTER_LIFECYCLE_EVENTS = keyMirror('client_connected', 'client_disconnected', 'client_error')

/**
 * Server error detail keys emitted with `client_error` and related failure paths.
 *
 * @remarks
 * `origin_rejected`, `connection_rejected`, and `upgrade_failed` describe
 * WebSocket handshake failures. `malformed_message` and `protocol_missing`
 * cover protocol violations from the client. `not_found` and
 * `internal_error` represent HTTP request handling failures.
 *
 * @public
 */
export const SERVER_ERRORS = keyMirror(
  'origin_rejected',
  'connection_rejected',
  'upgrade_failed',
  'malformed_message',
  'protocol_missing',
  'not_found',
  'internal_error',
)

/**
 * Behavioral event keys used to drive the server factory lifecycle.
 *
 * @public
 */
export const SERVER_FACTORY_EVENTS = keyMirror(
  'server_set_config',
  'server_config_updated',
  'server_start',
  'server_started',
  'server_stop',
  'server_stopped',
  'server_reload',
  'server_send',
  'server_error',
)

/**
 * Default signal keys written by the server factory state graph.
 *
 * @public
 */
export const SERVER_FACTORY_SIGNAL_KEYS = {
  config: 'server.config',
  status: 'server.status',
} as const

/**
 * Reserved contributor id representing the baseline route set owned directly by
 * the server factory.
 *
 * @public
 */
export const SERVER_FACTORY_BASELINE_ROUTE_OWNER = 'baseline'

/**
 * Default Content-Security-Policy header value for server-generated responses.
 *
 * @remarks
 * The policy allows same-origin document, script, and WebSocket access while
 * permitting inline styles required by SSR output. Callers must still attach
 * this header, or a stricter replacement, on routes that bypass the factory's
 * `fetch` handler such as Bun static routes.
 *
 * @public
 */
export const DEFAULT_CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
