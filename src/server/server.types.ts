import type { TLSOptions } from 'bun'
import type { Trigger } from '../behavioral.ts'
import type { SERVER_ERRORS } from './server.constants.ts'
import type { WebSocketData } from './server.schemas.ts'

/** Route map type extracted from Bun.serve, parameterized with our WebSocket data */
type ServeRoutes = Bun.Serve.Routes<WebSocketData, string>

/**
 * Factory options for {@link createServer}.
 *
 * @param trigger - BP event injection function — server lifecycle events flow through this
 * @param routes - Caller-provided route map passed directly to `Bun.serve()`
 * @param port - Port to listen on (0 for random, default 0)
 * @param tls - TLS certificate options passed to Bun.serve
 * @param allowedOrigins - Set of allowed Origin header values for WebSocket upgrades
 *
 * @public
 */
// ============================================================================
// UI Adapter Lifecycle Detail Types
// ============================================================================

/**
 * Detail payload for the `client_connected` event.
 *
 * @remarks
 * Triggered when a WebSocket connection is established.
 * `source` is the client identity from the `Sec-WebSocket-Protocol` header.
 *
 * @public
 */
export type UIClientConnectedDetail = { sessionId: string; source: string }

/**
 * Detail payload for the `client_disconnected` event.
 *
 * @public
 */
export type UIClientDisconnectedDetail = { sessionId: string }

/**
 * Detail payload for the `client_error` event.
 *
 * @remarks
 * `code` is a {@link SERVER_ERRORS} value identifying the error class.
 * Optional fields vary by error type.
 *
 * @public
 */
export type UIClientErrorDetail = {
  code: (typeof SERVER_ERRORS)[keyof typeof SERVER_ERRORS]
  sessionId?: string
  message?: string
  pathname?: string
}

export type CreateServerOptions = {
  trigger: Trigger
  routes: ServeRoutes
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
}
