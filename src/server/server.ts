import type { Server } from 'bun'
import { CLIENT_LIFECYCLE_EVENTS } from '../events.ts'
import { ClientMessageSchema } from '../ui.ts'
import { SERVER_ERRORS } from './server.constants.ts'
import type { WebSocketData } from './server.schemas.ts'
import type { CreateServerOptions } from './server.types.ts'

/** Server with WebSocket data typed for the controller protocol */
type ServerInstance = Server<WebSocketData>

/**
 * Creates a thin I/O server — the transport bridge between
 * browser clients and the agent's behavioral program.
 *
 * @remarks
 * The server has no behavioral program of its own. It is a stateless
 * connector that:
 * - Translates WebSocket messages into BP events via `trigger()`
 * - Fires lifecycle events (`CLIENT_LIFECYCLE_EVENTS`) so the agent's BP observes connections
 * - Manages security (origin validation, session cookies)
 * - Serves caller-provided routes directly
 *
 * Client identity (`source`) is carried via WebSocket subprotocol
 * (`Sec-WebSocket-Protocol` header) — no post-connect handshake message needed.
 *
 * @param options - Server configuration
 * @returns Raw `Bun.Server` instance
 *
 * @public
 */
export const createServer = ({
  trigger,
  routes,
  port = 0,
  tls,
  allowedOrigins,
}: CreateServerOptions): ServerInstance => {
  const server = Bun.serve({
    port,
    tls,
    routes,

    websocket: {
      data: {} as WebSocketData,

      open(ws) {
        const { sessionId, source } = ws.data
        const topic = source === 'document' ? sessionId : `${sessionId}:${source}`
        ws.subscribe(topic)
        trigger({
          type: CLIENT_LIFECYCLE_EVENTS.client_connected,
          detail: { sessionId, source },
        })
      },

      message(ws, message) {
        try {
          const parsed = JSON.parse(String(message))
          trigger(ClientMessageSchema.parse(parsed))
        } catch (error) {
          trigger({
            type: CLIENT_LIFECYCLE_EVENTS.client_error,
            detail: {
              code: SERVER_ERRORS.malformed_message,
              sessionId: ws.data.sessionId,
              message: error instanceof Error ? error.message : String(error),
            },
          })
        }
      },

      close(ws) {
        trigger({
          type: CLIENT_LIFECYCLE_EVENTS.client_disconnected,
          detail: { sessionId: ws.data.sessionId },
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
              type: CLIENT_LIFECYCLE_EVENTS.client_error,
              detail: { code: SERVER_ERRORS.origin_rejected },
            })
            return new Response(SERVER_ERRORS.origin_rejected, { status: 403 })
          }
        }

        // Session validation — parse cookies manually in fetch handler
        const cookies = new Bun.CookieMap(req.headers.get('cookie') ?? '')
        const sessionId = cookies.get('sid')
        if (!sessionId) {
          trigger({
            type: CLIENT_LIFECYCLE_EVENTS.client_error,
            detail: { code: SERVER_ERRORS.session_missing },
          })
          return new Response(SERVER_ERRORS.session_missing, { status: 401 })
        }

        // Subprotocol — carries client source identity
        const source = req.headers.get('sec-websocket-protocol')
        if (!source) {
          trigger({
            type: CLIENT_LIFECYCLE_EVENTS.client_error,
            detail: { code: SERVER_ERRORS.protocol_missing, sessionId },
          })
          return new Response(SERVER_ERRORS.protocol_missing, { status: 400 })
        }

        const upgraded = server.upgrade(req, {
          data: { sessionId, source },
          headers: { 'Sec-WebSocket-Protocol': source },
        })

        if (upgraded) return undefined

        trigger({
          type: CLIENT_LIFECYCLE_EVENTS.client_error,
          detail: { code: SERVER_ERRORS.upgrade_failed, sessionId },
        })
        return new Response(SERVER_ERRORS.upgrade_failed, { status: 400 })
      }

      // ── Not found ──────────────────────────────────────
      const url = new URL(req.url)
      trigger({
        type: CLIENT_LIFECYCLE_EVENTS.client_error,
        detail: { code: SERVER_ERRORS.not_found, pathname: url.pathname },
      })
      return new Response('Not Found', { status: 404 })
    },

    error(error) {
      trigger({
        type: CLIENT_LIFECYCLE_EVENTS.client_error,
        detail: { code: SERVER_ERRORS.internal_error, message: error.message },
      })
      return new Response('Internal Server Error', { status: 500 })
    },
  })

  return server
}
