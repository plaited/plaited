import { notSchema, useExtension } from '../../behavioral.ts'
import { ClientMessageSchema } from '../../ui.ts'
import {
  DEFAULT_CSP,
  SERVER_MODULE_ERROR_CODES,
  SERVER_MODULE_EVENTS,
  SERVER_MODULE_ID,
  SERVER_MODULE_WEBSOCKET_PATH,
  toServerModuleEventType,
} from './server-module.constants.ts'
import {
  ClientConnectedDetailSchema,
  ClientDisconnectedDetailSchema,
  ClientErrorDetailSchema,
  ServerErrorDetailSchema,
  type ServerSendDetail,
  ServerSendDetailSchema,
  type ServerStartDetail,
  ServerStartDetailSchema,
  ServerStartedDetailSchema,
  type ServerStopDetail,
  ServerStopDetailSchema,
  ServerStoppedDetailSchema,
  type WebSocketData,
} from './server-module.schemas.ts'
import type { CreateServerOptions, ServerHandle } from './server-module.types.ts'

const createScopedEvent = <TEvent extends string>(event: TEvent, detail?: unknown) =>
  detail === undefined
    ? {
        type: toServerModuleEventType(event),
      }
    : {
        type: toServerModuleEventType(event),
        detail,
      }

const createServer = ({
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
  const csp = cspOpt === false ? undefined : (cspOpt ?? DEFAULT_CSP)
  const securedResponse = (body: string, init: ResponseInit) =>
    csp
      ? new Response(body, {
          ...init,
          headers: {
            ...init.headers,
            'Content-Security-Policy': csp,
          },
        })
      : new Response(body, init)

  const emitClientError = (detail: unknown) =>
    trigger(createScopedEvent(SERVER_MODULE_EVENTS.client_error, ClientErrorDetailSchema.parse(detail)))

  const topicConnections = new Map<string, number>()
  const knownConnections = new Set<string>()
  const replayBuffers = new Map<string, Array<{ data: string; timestamp: number }>>()
  const maxBufferSize = replayBufferOpts?.maxSize ?? 32
  const bufferTtlMs = replayBufferOpts?.ttlMs ?? 5_000

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
          for (const entry of buffer) {
            if (now - entry.timestamp <= bufferTtlMs) {
              ws.sendText(entry.data)
            }
          }
          replayBuffers.delete(topic)
        }

        const isReconnect = knownConnections.has(connectionId)
        knownConnections.add(connectionId)
        trigger(
          createScopedEvent(
            SERVER_MODULE_EVENTS.client_connected,
            ClientConnectedDetailSchema.parse({
              connectionId,
              source,
              isReconnect,
              principalId,
              deviceId,
            }),
          ),
        )
      },
      message(ws, message) {
        try {
          const event = ClientMessageSchema.parse(JSON.parse(String(message)))
          trigger(event)
        } catch (error) {
          emitClientError({
            code: SERVER_MODULE_ERROR_CODES.malformed_message,
            connectionId: ws.data.connectionId,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      },
      close(ws, code, reason) {
        const { connectionId, principalId, deviceId } = ws.data
        const topic = topicFor(ws.data)
        const count = topicConnections.get(topic) ?? 0
        if (count <= 1) {
          topicConnections.delete(topic)
        } else {
          topicConnections.set(topic, count - 1)
        }

        const hasRemainingConnections = [...topicConnections.keys()].some(
          (candidate) => candidate === connectionId || candidate.startsWith(`${connectionId}:`),
        )
        if (!hasRemainingConnections) {
          setTimeout(() => {
            const stillConnected = [...topicConnections.keys()].some(
              (candidate) => candidate === connectionId || candidate.startsWith(`${connectionId}:`),
            )
            if (stillConnected) {
              return
            }
            knownConnections.delete(connectionId)
            for (const key of replayBuffers.keys()) {
              if (key === connectionId || key.startsWith(`${connectionId}:`)) {
                replayBuffers.delete(key)
              }
            }
          }, bufferTtlMs)
        }

        trigger(
          createScopedEvent(
            SERVER_MODULE_EVENTS.client_disconnected,
            ClientDisconnectedDetailSchema.parse({
              connectionId,
              code,
              reason: String(reason),
              principalId,
              deviceId,
            }),
          ),
        )
      },
    },
    async fetch(request, bunServer) {
      const url = new URL(request.url)
      const isWebSocketUpgrade = request.headers.get('upgrade')?.toLowerCase() === 'websocket'

      if (isWebSocketUpgrade) {
        if (url.pathname !== SERVER_MODULE_WEBSOCKET_PATH) {
          emitClientError({
            code: SERVER_MODULE_ERROR_CODES.not_found,
            pathname: url.pathname,
          })
          return securedResponse('Not Found', { status: 404 })
        }

        if (allowedOrigins) {
          const origin = request.headers.get('origin')
          if (!origin || !allowedOrigins.has(origin)) {
            emitClientError({
              code: SERVER_MODULE_ERROR_CODES.origin_rejected,
            })
            return securedResponse(SERVER_MODULE_ERROR_CODES.origin_rejected, { status: 403 })
          }
        }

        const source = request.headers.get('sec-websocket-protocol')
        if (!source) {
          emitClientError({
            code: SERVER_MODULE_ERROR_CODES.protocol_missing,
          })
          return securedResponse(SERVER_MODULE_ERROR_CODES.protocol_missing, { status: 400 })
        }

        const authenticated = await authenticateConnection({
          request,
          source,
        })
        if (!authenticated) {
          emitClientError({
            code: SERVER_MODULE_ERROR_CODES.connection_rejected,
          })
          return securedResponse(SERVER_MODULE_ERROR_CODES.connection_rejected, { status: 401 })
        }

        const upgraded = bunServer.upgrade(request, {
          data: {
            connectionId: authenticated.connectionId,
            source,
            principalId: authenticated.principalId,
            deviceId: authenticated.deviceId,
            capabilities: authenticated.capabilities,
          },
          headers: {
            'Sec-WebSocket-Protocol': source,
          },
        })
        if (upgraded) {
          return undefined
        }

        emitClientError({
          code: SERVER_MODULE_ERROR_CODES.upgrade_failed,
          connectionId: authenticated.connectionId,
        })
        return securedResponse(SERVER_MODULE_ERROR_CODES.upgrade_failed, { status: 400 })
      }

      emitClientError({
        code: SERVER_MODULE_ERROR_CODES.not_found,
        pathname: url.pathname,
      })
      return securedResponse('Not Found', { status: 404 })
    },
    error(error) {
      emitClientError({
        code: SERVER_MODULE_ERROR_CODES.internal_error,
        message: error.message,
      })
      return securedResponse('Internal Server Error', { status: 500 })
    },
  })

  const send = (topic: string, data: string) => {
    const activeConnections = topicConnections.get(topic) ?? 0
    if (activeConnections > 0) {
      server.publish(topic, data)
      return
    }
    if (maxBufferSize === 0) {
      return
    }

    const current = replayBuffers.get(topic) ?? []
    current.push({ data, timestamp: Date.now() })
    while (current.length > maxBufferSize) {
      current.shift()
    }
    replayBuffers.set(topic, current)
  }

  const resolvedPort = server.port
  if (resolvedPort === undefined) {
    server.stop(true)
    throw new Error('Server started without a resolved listening port.')
  }

  return {
    server,
    port: resolvedPort,
    send,
    stop: (closeActiveConnections?: boolean) => {
      server.stop(closeActiveConnections)
    },
  }
}

export const serverModuleExtension = useExtension(SERVER_MODULE_ID, ({ bThread, bSync, trigger }) => {
  let liveServer: ServerHandle | null = null

  const emitServerStopped = (port?: number) =>
    trigger(
      createScopedEvent(
        SERVER_MODULE_EVENTS.server_stopped,
        ServerStoppedDetailSchema.parse({
          ...(port !== undefined && { port }),
        }),
      ),
    )

  const emitServerError = (detail: unknown) =>
    trigger(createScopedEvent(SERVER_MODULE_EVENTS.server_error, ServerErrorDetailSchema.parse(detail)))

  const stopServer = (detail?: ServerStopDetail) => {
    const closeActiveConnections = detail?.closeActiveConnections ?? true
    const activePort = liveServer?.port
    if (liveServer) {
      liveServer.stop(closeActiveConnections)
      liveServer = null
    }
    emitServerStopped(activePort)
  }

  const startServer = (detail: ServerStartDetail) => {
    if (liveServer) {
      stopServer({
        closeActiveConnections: true,
      })
    }

    try {
      liveServer = createServer({
        trigger,
        ...detail,
      })
      trigger(
        createScopedEvent(
          SERVER_MODULE_EVENTS.server_started,
          ServerStartedDetailSchema.parse({
            port: liveServer.port,
          }),
        ),
      )
    } catch (error) {
      liveServer = null
      emitServerError({
        code: SERVER_MODULE_ERROR_CODES.internal_error,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  bThread({
    label: 'validateServerStart',
    rules: [
      bSync({
        block: {
          type: SERVER_MODULE_EVENTS.server_start,
          detailSchema: notSchema(ServerStartDetailSchema),
        },
      }),
    ],
    repeat: true,
  })

  bThread({
    label: 'validateServerStop',
    rules: [
      bSync({
        block: {
          type: SERVER_MODULE_EVENTS.server_stop,
          detailSchema: notSchema(ServerStopDetailSchema),
        },
      }),
    ],
    repeat: true,
  })

  bThread({
    label: 'validateServerSend',
    rules: [
      bSync({
        block: {
          type: SERVER_MODULE_EVENTS.server_send,
          detailSchema: notSchema(ServerSendDetailSchema),
        },
      }),
    ],
    repeat: true,
  })

  return {
    [SERVER_MODULE_EVENTS.server_start](detail: ServerStartDetail) {
      const parsed = ServerStartDetailSchema.safeParse(detail)
      if (!parsed.success) {
        return
      }
      startServer(parsed.data)
    },
    [SERVER_MODULE_EVENTS.server_stop](detail: ServerStopDetail) {
      const parsed = ServerStopDetailSchema.safeParse(detail)
      if (!parsed.success) {
        return
      }
      stopServer(parsed.data)
    },
    [SERVER_MODULE_EVENTS.server_send](detail: ServerSendDetail) {
      const parsed = ServerSendDetailSchema.safeParse(detail)
      if (!parsed.success) {
        return
      }
      if (!liveServer) {
        emitServerError({
          code: SERVER_MODULE_ERROR_CODES.server_not_running,
          message: 'Cannot send server message because no server is currently running.',
        })
        return
      }
      liveServer.send(parsed.data.topic, parsed.data.data)
    },
  }
})
