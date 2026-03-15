import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import { ClientMessageSchema } from '../ui.ts'
import { DEFAULT_CSP, SERVER_ERRORS } from './server.constants.ts'
import type { WebSocketData } from './server.schemas.ts'
import type { CreateServerOptions, ServerHandle } from './server.types.ts'

/**
 * Creates a thin I/O server — the transport bridge between
 * browser clients and the agent's behavioral program.
 *
 * @remarks
 * The server has no behavioral program of its own. It is a stateless
 * connector that:
 * - Translates WebSocket messages into BP events via `trigger()`
 * - Fires lifecycle events (`UI_ADAPTER_LIFECYCLE_EVENTS`) so the agent's BP observes connections
 * - Manages security (origin validation, session cookies)
 * - Buffers messages during MPA navigation gaps and replays on reconnect
 * - Serves caller-provided routes directly
 *
 * Client identity (`source`) is carried via WebSocket subprotocol
 * (`Sec-WebSocket-Protocol` header) — no post-connect handshake message needed.
 *
 * @param options - Server configuration
 * @returns {@link ServerHandle} wrapping the Bun server
 *
 * @public
 */
export const createServer = ({
  trigger,
  routes,
  port = 0,
  tls,
  allowedOrigins,
  validateSession,
  wsLimits,
  replayBuffer: replayBufferOpts,
  csp: cspOpt,
}: CreateServerOptions): ServerHandle => {
  // ── Security headers ───────────────────────────────────────────────────
  const cspValue = cspOpt === false ? undefined : (cspOpt ?? DEFAULT_CSP)
  const securedResponse = (body: string, init: ResponseInit) =>
    cspValue
      ? new Response(body, { ...init, headers: { ...init.headers, 'Content-Security-Policy': cspValue } })
      : new Response(body, init)

  // ── Connection tracking ──────────────────────────────────────────────────
  const topicConnections = new Map<string, number>()
  const knownSessions = new Set<string>()

  // ── Replay buffer for MPA navigation gaps ────────────────────────────────
  const maxBufferSize = replayBufferOpts?.maxSize ?? 32
  const bufferTtlMs = replayBufferOpts?.ttlMs ?? 5_000
  const replayBuffers = new Map<string, Array<{ data: string; timestamp: number }>>()

  /** Compute the pub/sub topic for a WebSocket connection */
  const topicFor = (data: WebSocketData) =>
    data.source === 'document' ? data.sessionId : `${data.sessionId}:${data.source}`

  const server = Bun.serve({
    port,
    tls,
    routes,

    websocket: {
      idleTimeout: wsLimits?.idleTimeout ?? 120,
      maxPayloadLength: wsLimits?.maxPayloadLength ?? 1_048_576,
      data: {} as WebSocketData,

      open(ws) {
        const { sessionId, source } = ws.data
        const topic = topicFor(ws.data)
        ws.subscribe(topic)

        // Track active connections per topic
        topicConnections.set(topic, (topicConnections.get(topic) ?? 0) + 1)

        // Replay buffered messages from MPA navigation gap
        const buffer = replayBuffers.get(topic)
        if (buffer) {
          const now = Date.now()
          for (const msg of buffer) {
            if (now - msg.timestamp < bufferTtlMs) {
              ws.sendText(msg.data)
            }
          }
          replayBuffers.delete(topic)
        }

        // Detect reconnection for SSR reconciliation
        const isReconnect = knownSessions.has(sessionId)
        knownSessions.add(sessionId)

        trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
          detail: { sessionId, source, isReconnect },
        })
      },

      message(ws, message) {
        try {
          const parsed = JSON.parse(String(message))
          trigger(ClientMessageSchema.parse(parsed))
        } catch (error) {
          trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
            detail: {
              code: SERVER_ERRORS.malformed_message,
              sessionId: ws.data.sessionId,
              message: error instanceof Error ? error.message : String(error),
            },
          })
        }
      },

      close(ws, code, reason) {
        const { sessionId } = ws.data
        const topic = topicFor(ws.data)

        // Decrement connection count
        const count = topicConnections.get(topic) ?? 0
        if (count <= 1) topicConnections.delete(topic)
        else topicConnections.set(topic, count - 1)

        // Evict session from knownSessions when no connections remain for this sessionId
        // Check all topics that could reference this session
        const hasRemainingConnections = [...topicConnections.keys()].some(
          (t) => t === sessionId || t.startsWith(`${sessionId}:`),
        )
        if (!hasRemainingConnections) {
          // Schedule cleanup after replay buffer grace period
          setTimeout(() => {
            // Only evict if still no connections
            const stillConnected = [...topicConnections.keys()].some(
              (t) => t === sessionId || t.startsWith(`${sessionId}:`),
            )
            if (!stillConnected) {
              knownSessions.delete(sessionId)
              // Clean up any lingering replay buffers for this session
              for (const key of replayBuffers.keys()) {
                if (key === sessionId || key.startsWith(`${sessionId}:`)) {
                  replayBuffers.delete(key)
                }
              }
            }
          }, bufferTtlMs)
        }

        trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected,
          detail: { sessionId, code, reason },
        })
      },
    },

    fetch(req, server) {
      // ── WebSocket upgrade ──────────────────────────────
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        // Origin validation
        if (allowedOrigins) {
          const origin = req.headers.get('origin')
          if (!origin || !allowedOrigins.has(origin)) {
            trigger({
              type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
              detail: { code: SERVER_ERRORS.origin_rejected },
            })
            return securedResponse(SERVER_ERRORS.origin_rejected, { status: 403 })
          }
        }

        // Session validation — parse cookies manually in fetch handler
        const cookies = new Bun.CookieMap(req.headers.get('cookie') ?? '')
        const sessionId = cookies.get('sid')
        if (!sessionId) {
          trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
            detail: { code: SERVER_ERRORS.session_missing },
          })
          return securedResponse(SERVER_ERRORS.session_missing, { status: 401 })
        }

        if (!validateSession(sessionId)) {
          trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
            detail: { code: SERVER_ERRORS.session_invalid, sessionId },
          })
          return securedResponse(SERVER_ERRORS.session_invalid, { status: 401 })
        }

        // Subprotocol — carries client source identity
        const source = req.headers.get('sec-websocket-protocol')
        if (!source) {
          trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
            detail: { code: SERVER_ERRORS.protocol_missing, sessionId },
          })
          return securedResponse(SERVER_ERRORS.protocol_missing, { status: 400 })
        }

        const upgraded = server.upgrade(req, {
          data: { sessionId, source },
          headers: { 'Sec-WebSocket-Protocol': source },
        })

        if (upgraded) return undefined

        trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
          detail: { code: SERVER_ERRORS.upgrade_failed, sessionId },
        })
        return securedResponse(SERVER_ERRORS.upgrade_failed, { status: 400 })
      }

      // ── Not found ──────────────────────────────────────
      const url = new URL(req.url)
      trigger({
        type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
        detail: { code: SERVER_ERRORS.not_found, pathname: url.pathname },
      })
      return securedResponse('Not Found', { status: 404 })
    },

    error(error) {
      trigger({
        type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
        detail: { code: SERVER_ERRORS.internal_error, message: error.message },
      })
      return securedResponse('Internal Server Error', { status: 500 })
    },
  })

  /** Send with replay buffering for MPA navigation gaps */
  const send = (topic: string, data: string) => {
    const count = topicConnections.get(topic) ?? 0
    if (count > 0) {
      server.publish(topic, data)
      return
    }
    if (maxBufferSize === 0) return
    let buffer = replayBuffers.get(topic)
    if (!buffer) {
      buffer = []
      replayBuffers.set(topic, buffer)
    }
    buffer.push({ data, timestamp: Date.now() })
    if (buffer.length > maxBufferSize) buffer.shift()
  }

  return {
    server,
    port: server.port!,
    send,
    stop: (closeActive?: boolean) => server.stop(closeActive),
  }
}
