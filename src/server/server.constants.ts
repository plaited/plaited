import { keyMirror } from '../utils.ts'

/**
 * Lifecycle event constants for the server transport layer.
 *
 * @remarks
 * Server-owned events triggered into the agent's BP:
 * - `client_connected` — WebSocket opened (source identified via subprotocol)
 * - `client_disconnected` — WebSocket closed
 * - `error` — transport-level error (origin rejected, missing session, malformed message, etc.)
 *
 * Error codes from {@link SERVER_ERRORS} are carried in the `error` event's detail.
 *
 * @public
 */
export const SERVER_EVENTS = keyMirror('client_connected', 'client_disconnected', 'error')

/**
 * Error type constants for the server module.
 *
 * @remarks
 * Used as error detail codes in `SERVER_EVENTS.error` triggers:
 * - `origin_rejected` — WebSocket upgrade denied due to origin mismatch
 * - `upgrade_failed` — WebSocket upgrade call returned false
 * - `malformed_message` — Client sent a message that failed JSON parse or Zod validation
 * - `session_missing` — WebSocket upgrade accessed without `sid` cookie
 * - `protocol_missing` — WebSocket upgrade without `Sec-WebSocket-Protocol` header
 * - `not_found` — HTTP request for unmatched path (404)
 * - `internal_error` — Uncaught exception in request handler (500)
 *
 * @public
 */
export const SERVER_ERRORS = keyMirror(
  'origin_rejected',
  'upgrade_failed',
  'malformed_message',
  'session_missing',
  'protocol_missing',
  'not_found',
  'internal_error',
)
