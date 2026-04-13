import { AGENT_CORE_EVENTS, type Module } from '../../agent.ts'
import { ClientMessageSchema } from '../../ui.ts'
import {
  DEFAULT_CSP,
  SERVER_ERRORS,
  SERVER_MODULE_EVENTS,
  SERVER_MODULE_SIGNAL_KEYS,
  UI_ADAPTER_LIFECYCLE_EVENTS,
} from './server-module.constants.ts'
import {
  type ServerModuleConfig,
  ServerModuleConfigSchema,
  type ServerModuleStatus,
  ServerModuleStatusSchema,
  ServerSendDetailSchema,
  type WebSocketData,
} from './server-module.schemas.ts'
import type { CreateServerModuleOptions, CreateServerOptions, ServerHandle } from './server-module.types.ts'

/**
 * Creates a thin I/O server — the transport bridge between
 * browser clients and the agent's behavioral program.
 *
 * @remarks
 * The server has no behavioral program of its own. It is a stateless
 * connector that:
 * - Translates WebSocket messages into BP events via `trigger()`
 * - Fires lifecycle events (`UI_ADAPTER_LIFECYCLE_EVENTS`) so the agent's BP observes connections
 * - Applies transport policy (origin validation, connection authentication)
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
  authenticateConnection,
  wsLimits,
  replayBuffer: replayBufferOpts,
  csp: cspOpt,
}: CreateServerOptions): ServerHandle => {
  const cspValue = cspOpt === false ? undefined : (cspOpt ?? DEFAULT_CSP)
  const securedResponse = (body: string, init: ResponseInit) =>
    cspValue
      ? new Response(body, { ...init, headers: { ...init.headers, 'Content-Security-Policy': cspValue } })
      : new Response(body, init)

  const topicConnections = new Map<string, number>()
  const knownConnections = new Set<string>()

  const maxBufferSize = replayBufferOpts?.maxSize ?? 32
  const bufferTtlMs = replayBufferOpts?.ttlMs ?? 5_000
  const replayBuffers = new Map<string, Array<{ data: string; timestamp: number }>>()

  const topicFor = (data: WebSocketData) =>
    data.source === 'document' ? data.connectionId : `${data.connectionId}:${data.source}`

  const hasRoutes = Object.keys(routes).length > 0
  const server = Bun.serve({
    port,
    tls,
    ...(hasRoutes && { routes }),

    websocket: {
      idleTimeout: wsLimits?.idleTimeout ?? 120,
      maxPayloadLength: wsLimits?.maxPayloadLength ?? 1_048_576,
      data: {} as WebSocketData,

      open(ws) {
        const { connectionId, source, principalId, deviceId } = ws.data
        const topic = topicFor(ws.data)
        ws.subscribe(topic)

        topicConnections.set(topic, (topicConnections.get(topic) ?? 0) + 1)

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

        const isReconnect = knownConnections.has(connectionId)
        knownConnections.add(connectionId)

        trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
          detail: { connectionId, source, isReconnect, principalId, deviceId },
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
              connectionId: ws.data.connectionId,
              message: error instanceof Error ? error.message : String(error),
            },
          })
        }
      },

      close(ws, code, reason) {
        const { connectionId, principalId, deviceId } = ws.data
        const topic = topicFor(ws.data)

        const count = topicConnections.get(topic) ?? 0
        if (count <= 1) topicConnections.delete(topic)
        else topicConnections.set(topic, count - 1)

        const hasRemainingConnections = [...topicConnections.keys()].some(
          (t) => t === connectionId || t.startsWith(`${connectionId}:`),
        )
        if (!hasRemainingConnections) {
          setTimeout(() => {
            const stillConnected = [...topicConnections.keys()].some(
              (t) => t === connectionId || t.startsWith(`${connectionId}:`),
            )
            if (!stillConnected) {
              knownConnections.delete(connectionId)
              for (const key of replayBuffers.keys()) {
                if (key === connectionId || key.startsWith(`${connectionId}:`)) {
                  replayBuffers.delete(key)
                }
              }
            }
          }, bufferTtlMs)
        }

        trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected,
          detail: { connectionId, code, reason, principalId, deviceId },
        })
      },
    },

    async fetch(req, server) {
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
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

        const source = req.headers.get('sec-websocket-protocol')
        if (!source) {
          trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
            detail: { code: SERVER_ERRORS.protocol_missing },
          })
          return securedResponse(SERVER_ERRORS.protocol_missing, { status: 400 })
        }

        const authenticated = await authenticateConnection({
          request: req,
          source,
        })

        if (!authenticated) {
          trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
            detail: { code: SERVER_ERRORS.connection_rejected },
          })
          return securedResponse(SERVER_ERRORS.connection_rejected, { status: 401 })
        }

        const upgraded = server.upgrade(req, {
          data: {
            connectionId: authenticated.connectionId,
            source,
            principalId: authenticated.principalId,
            deviceId: authenticated.deviceId,
            capabilities: authenticated.capabilities,
          },
          headers: { 'Sec-WebSocket-Protocol': source },
        })

        if (upgraded) return undefined

        trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_error,
          detail: { code: SERVER_ERRORS.upgrade_failed, connectionId: authenticated.connectionId },
        })
        return securedResponse(SERVER_ERRORS.upgrade_failed, { status: 400 })
      }

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

const canStartServer = (
  config?: ServerModuleConfig,
): config is ServerModuleConfig & {
  authenticateConnection: NonNullable<CreateServerOptions['authenticateConnection']>
} => {
  return !!config?.authenticateConnection
}

/**
 * Creates a behavioral module lane that owns a live server instance.
 *
 * @remarks
 * The live `Bun.serve()` instance is held privately in the module closure and
 * controlled through behavioral events plus signal-backed config/status.
 *
 * Other modules can contribute config by writing to the config signal, and
 * can operate the live lane by triggering `SERVER_MODULE_EVENTS`.
 *
 * @public
 */
export const createServerModule =
  ({
    configSignalKey = SERVER_MODULE_SIGNAL_KEYS.config,
    statusSignalKey = SERVER_MODULE_SIGNAL_KEYS.status,
    initialConfig,
  }: CreateServerModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const configSignal =
      signals.get(configSignalKey) ??
      signals.set({
        key: configSignalKey,
        schema: ServerModuleConfigSchema,
        value: {
          routes: {},
          port: 0,
          autostart: true,
          ...initialConfig,
        },
        readOnly: false,
      })

    const statusSignal =
      signals.get(statusSignalKey) ??
      signals.set({
        key: statusSignalKey,
        schema: ServerModuleStatusSchema,
        value: { state: 'stopped' },
        readOnly: true,
      })

    let currentConfig = ServerModuleConfigSchema.parse(configSignal.get() ?? {})
    let liveServer: ServerHandle | undefined

    const publishStatus = (status: ServerModuleStatus) => {
      statusSignal.set?.(status)
    }

    const stopServer = () => {
      if (!liveServer) {
        publishStatus({ state: 'stopped' })
        return
      }

      liveServer.stop(true)
      liveServer = undefined
      publishStatus({ state: 'stopped' })
      trigger({
        type: SERVER_MODULE_EVENTS.server_stopped,
      })
    }

    const startServer = () => {
      if (!canStartServer(currentConfig)) {
        const error = `Cannot start server without authenticateConnection in signal '${configSignalKey}'`
        publishStatus({ state: 'error', error })
        trigger({
          type: SERVER_MODULE_EVENTS.server_error,
          detail: { message: error },
        })
        return
      }

      stopServer()
      publishStatus({ state: 'starting' })

      try {
        liveServer = createServer({
          routes: currentConfig.routes,
          port: currentConfig.port,
          tls: currentConfig.tls,
          allowedOrigins: currentConfig.allowedOrigins,
          authenticateConnection: currentConfig.authenticateConnection,
          wsLimits: currentConfig.wsLimits,
          replayBuffer: currentConfig.replayBuffer,
          csp: currentConfig.csp,
          trigger,
        })
        publishStatus({ state: 'running', port: liveServer.port })
        trigger({
          type: SERVER_MODULE_EVENTS.server_started,
          detail: { port: liveServer.port },
        })
      } catch (error) {
        liveServer = undefined
        const message = error instanceof Error ? error.message : String(error)
        publishStatus({ state: 'error', error: message })
        trigger({
          type: SERVER_MODULE_EVENTS.server_error,
          detail: { message },
        })
      }
    }

    configSignal.listen(SERVER_MODULE_EVENTS.server_config_updated)

    currentConfig = ServerModuleConfigSchema.parse(configSignal.get() ?? {})
    if (currentConfig.autostart) {
      startServer()
    }

    return {
      handlers: {
        [SERVER_MODULE_EVENTS.server_set_config](detail) {
          const parsed = ServerModuleConfigSchema.safeParse(detail)
          if (!parsed.success) return
          configSignal.set?.(parsed.data)
        },
        [SERVER_MODULE_EVENTS.server_config_updated]() {
          currentConfig = ServerModuleConfigSchema.parse(configSignal.get() ?? {})
          if (currentConfig.autostart) {
            startServer()
          }
        },
        [SERVER_MODULE_EVENTS.server_start]() {
          startServer()
        },
        [SERVER_MODULE_EVENTS.server_stop]() {
          stopServer()
        },
        [SERVER_MODULE_EVENTS.server_reload]() {
          startServer()
        },
        [SERVER_MODULE_EVENTS.server_send](detail) {
          const parsed = ServerSendDetailSchema.safeParse(detail)
          if (!parsed.success || !liveServer) return
          liveServer.send(parsed.data.topic, parsed.data.data)
        },
        [AGENT_CORE_EVENTS.agent_disconnect]() {
          stopServer()
        },
      },
    }
  }
