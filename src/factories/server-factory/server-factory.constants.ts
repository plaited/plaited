import { keyMirror } from '../../utils.ts'

/**
 * Error type constants for the server module.
 *
 * @remarks
 * Used as error detail codes in `UI_ADAPTER_LIFECYCLE_EVENTS.client_error` triggers:
 * - `origin_rejected` — WebSocket upgrade denied due to origin mismatch
 * - `connection_rejected` — WebSocket upgrade denied by the connection auth seam
 * - `upgrade_failed` — WebSocket upgrade call returned false
 * - `malformed_message` — Client sent a message that failed JSON parse or Zod validation
 * - `protocol_missing` — WebSocket upgrade without `Sec-WebSocket-Protocol` header
 * - `not_found` — HTTP request for unmatched path (404)
 * - `internal_error` — Uncaught exception in request handler (500)
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
 * Behavioral event types for the server factory lane.
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
 * Default signal keys used by the server factory lane.
 *
 * @public
 */
export const SERVER_FACTORY_SIGNAL_KEYS = {
  config: 'server.config',
  status: 'server.status',
} as const

/**
 * Default Content-Security-Policy header value.
 *
 * @remarks
 * Mitigates two attack vectors (see plaited-ui skill, references/websocket-decisions.md):
 * - `connect-src 'self'` — blocks Cross-Site WebSocket Hijacking (CSWSH)
 * - `script-src 'self'` — prevents injected inline scripts from executing
 * - `style-src 'self' 'unsafe-inline'` — allows SSR-generated inline `<style>` tags
 * - `default-src 'self'` — baseline restriction for all other resource types
 *
 * Callers should include this (or a custom policy) on their own route responses
 * since Bun static routes bypass the `fetch` handler.
 *
 * @public
 */
export const DEFAULT_CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
