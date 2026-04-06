import type { Server, TLSOptions } from 'bun'
import type { Module } from '../../agent.ts'
import type { Trigger } from '../../behavioral.ts'
import type { SERVER_ERRORS } from './server-module.constants.ts'
import type { WebSocketData } from './server-module.schemas.ts'

/** Route map type extracted from Bun.serve, parameterized with our WebSocket data */
export type ServeRoutes = Bun.Serve.Routes<WebSocketData, string>

/** @public */
export type RouteContributions = Record<string, ServeRoutes>

/** @public */
export type RouteConflictOwner =
  | { kind: 'baseline' }
  | {
      kind: 'contribution'
      contributorId: string
    }

/** @public */
export type RouteMergeResult =
  | {
      ok: true
      routes: ServeRoutes
    }
  | {
      ok: false
      conflicts: Array<{
        path: string
        owners: RouteConflictOwner[]
      }>
    }

/**
 * Detail payload for the `client_connected` event.
 *
 * @remarks
 * Triggered when a WebSocket connection is established.
 * `source` is the client identity from the `Sec-WebSocket-Protocol` header.
 * `isReconnect` is true when this connection has had a prior WebSocket connection
 * during the server's lifetime — enables SSR reconciliation (the BP can
 * push fresh state on reconnect vs skip on first connect).
 *
 * @public
 */
export type UIClientConnectedDetail = {
  connectionId: string
  source: string
  isReconnect: boolean
  principalId?: string
  deviceId?: string
}

/**
 * Detail payload for the `client_disconnected` event.
 *
 * @remarks
 * `code` and `reason` come from the WebSocket close frame.
 * Common codes: 1000 (normal), 1001 (going away — page navigation),
 * 1006 (abnormal — no close frame received).
 *
 * @public
 */
export type UIClientDisconnectedDetail = {
  connectionId: string
  code: number
  reason: string
  principalId?: string
  deviceId?: string
}

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
  connectionId?: string
  message?: string
  pathname?: string
}

/**
 * Authenticated connection metadata returned by the auth seam.
 *
 * @public
 */
export type AuthenticatedConnection = {
  connectionId: string
  principalId?: string
  deviceId?: string
  capabilities?: string[]
}

/**
 * Authentication seam used during WebSocket upgrade handling.
 *
 * @public
 */
export type AuthenticateConnection = (input: {
  request: Request
  source: string
}) => AuthenticatedConnection | Promise<AuthenticatedConnection | null> | null

/**
 * Configuration for the per-topic message replay buffer.
 *
 * @remarks
 * During MPA view transitions there is a brief window (~50-100ms) where
 * no WebSocket is connected. The replay buffer captures messages sent
 * during this gap and replays them when a subscriber reconnects.
 *
 * @public
 */
export type ReplayBufferOptions = {
  /** Max buffered messages per topic (default: 32) */
  maxSize?: number
  /** Message TTL in milliseconds — expired messages are discarded on replay (default: 5000) */
  ttlMs?: number
}

/**
 * WebSocket connection limits for DoS prevention.
 *
 * @public
 */
export type WebSocketLimits = {
  /** Seconds before an idle connection is closed (default: 120) */
  idleTimeout?: number
  /** Maximum incoming message size in bytes (default: 1048576 / 1MB) */
  maxPayloadLength?: number
}

/**
 * Module options for {@link createServer}.
 *
 * @public
 */
export type CreateServerOptions = {
  trigger: Trigger
  routes: ServeRoutes
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
  authenticateConnection: AuthenticateConnection
  wsLimits?: WebSocketLimits
  replayBuffer?: ReplayBufferOptions
  /** Content-Security-Policy header value for server-generated responses.
   * Defaults to {@link DEFAULT_CSP}. Pass `false` to disable. */
  csp?: string | false
}

/**
 * Handle returned by {@link createServer}.
 *
 * @remarks
 * Wraps the raw Bun server with a `send()` method that buffers messages
 * during connection gaps (MPA view transitions) and replays them on reconnect.
 * Access the raw `Bun.Server` via the `server` property for direct pub/sub
 * when buffering isn't needed.
 *
 * @public
 */
export type ServerHandle = {
  /** Raw Bun server instance */
  readonly server: Server<WebSocketData>
  /** Port the server is listening on */
  readonly port: number
  /**
   * Send a message to a pub/sub topic. If no WebSocket connections are
   * currently subscribed to the topic, the message is buffered and
   * replayed when a subscriber reconnects.
   */
  send: (topic: string, data: string) => void
  /** Stop the server */
  stop: (closeActiveConnections?: boolean) => void
}

/**
 * Options for creating the server module wrapper.
 *
 * @public
 */
export type CreateServerModuleOptions = {
  configSignalKey?: string
  statusSignalKey?: string
  initialConfig?: Partial<CreateServerOptions> & { autostart?: boolean }
}

/**
 * Module signature for the server module lane.
 *
 * @public
 */
export type ServerModule = Module
