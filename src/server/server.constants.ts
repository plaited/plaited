import { keyMirror } from '../utils.ts'

/**
 * Error type constants for the server module.
 *
 * @remarks
 * Used as error detail codes in `UI_ADAPTER_LIFECYCLE_EVENTS.client_error` triggers:
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
