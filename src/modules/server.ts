import type { Server, TLSOptions } from 'bun'
import * as z from 'zod'
import type { Trigger } from '../behavioral.ts'
import { SNAPSHOT_MESSAGE_KINDS, useExtension } from '../behavioral.ts'
import type { ClientMessage } from '../ui.ts'
import { keyMirror } from '../utils.ts'
import { createUiWebsocketRuntimeActor } from './server/create-ui-websocket-runtime-actor.ts'

export type {
  CreateUiWebsocketRuntimeActorOptions,
  UiWebsocketEgressResult,
  UiWebsocketIngressResult,
  UiWebsocketRuntimeActor,
  UiWebsocketRuntimeValidationDiagnostic,
} from './server/create-ui-websocket-runtime-actor.ts'
export {
  createUiWebsocketRuntimeActor,
  UI_WEBSOCKET_RUNTIME_DIAGNOSTIC_CODES,
} from './server/create-ui-websocket-runtime-actor.ts'

export const SERVER_MODULE_ID = 'server_module'

export const SERVER_MODULE_EVENTS = keyMirror(
  'server_start',
  'server_stop',
  'server_send',
  'server_started',
  'server_stopped',
  'server_error',
  'client_connected',
  'client_disconnected',
  'client_error',
)

export const SERVER_MODULE_ERROR_CODES = keyMirror(
  'origin_rejected',
  'connection_rejected',
  'upgrade_failed',
  'malformed_message',
  'protocol_missing',
  'not_found',
  'internal_error',
  'server_not_running',
)

export const SERVER_MODULE_WEBSOCKET_PATH = '/ws'

export const DEFAULT_CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"

export const toServerModuleEventType = <TEvent extends string>(event: TEvent): `${typeof SERVER_MODULE_ID}:${TEvent}` =>
  `${SERVER_MODULE_ID}:${event}`

export type AuthenticatedConnection = {
  connectionId: string
  principalId?: string
  deviceId?: string
  capabilities?: string[]
}

export type AuthenticateConnection = (input: {
  request: Request
  source: string
}) => AuthenticatedConnection | Promise<AuthenticatedConnection | null> | null

export const WebSocketDataSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})
export type WebSocketData = z.infer<typeof WebSocketDataSchema>

export const ReplayBufferOptionsSchema = z.object({
  maxSize: z.number().int().nonnegative().optional(),
  ttlMs: z.number().int().nonnegative().optional(),
})
export type ReplayBufferOptions = z.infer<typeof ReplayBufferOptionsSchema>

export const WebSocketLimitsSchema = z.object({
  idleTimeout: z.number().int().nonnegative().optional(),
  maxPayloadLength: z.number().int().nonnegative().optional(),
})
export type WebSocketLimits = z.infer<typeof WebSocketLimitsSchema>

export type ServeRoutes = Bun.Serve.Routes<WebSocketData, string>

export type ServerModuleErrorCode = (typeof SERVER_MODULE_ERROR_CODES)[keyof typeof SERVER_MODULE_ERROR_CODES]

export type CreateServerOptions = {
  trigger: Trigger
  onClientMessage: (message: ClientMessage) => void
  reportTransportError: (detail: {
    code: ServerModuleErrorCode
    connectionId?: string
    message?: string
    pathname?: string
  }) => void
  routes: ServeRoutes
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
  authenticateConnection: AuthenticateConnection
  wsLimits?: WebSocketLimits
  replayBuffer?: ReplayBufferOptions
  csp?: string | false
}

export type ServerHandle = {
  readonly server: Server<WebSocketData>
  readonly port: number
  send: (topic: string, data: string) => void
  stop: (closeActiveConnections?: boolean) => void
}

const ServeRoutesSchema = z.custom<ServeRoutes>((value) => value !== null && typeof value === 'object')
const AllowedOriginsSchema = z.custom<Set<string> | undefined>((value) => value === undefined || value instanceof Set)
const AuthenticateConnectionSchema = z.custom<AuthenticateConnection>((value) => typeof value === 'function')
const TLSOptionsSchema = z.custom<Bun.TLSOptions>((_) => true)

export const ServerStartDetailSchema = z.object({
  routes: ServeRoutesSchema.default({}),
  port: z.number().int().nonnegative().default(0),
  tls: TLSOptionsSchema.optional(),
  allowedOrigins: AllowedOriginsSchema.optional(),
  authenticateConnection: AuthenticateConnectionSchema,
  wsLimits: WebSocketLimitsSchema.optional(),
  replayBuffer: ReplayBufferOptionsSchema.optional(),
  csp: z.union([z.string(), z.literal(false)]).optional(),
})
export type ServerStartDetail = z.infer<typeof ServerStartDetailSchema>

export const ServerStopDetailSchema = z
  .object({
    closeActiveConnections: z.boolean().optional(),
  })
  .optional()
export type ServerStopDetail = z.infer<typeof ServerStopDetailSchema>

export const ServerSendDetailSchema = z.object({
  topic: z.string().min(1),
  data: z.string(),
})
export type ServerSendDetail = z.infer<typeof ServerSendDetailSchema>

export const ServerStartedDetailSchema = z.object({
  port: z.number().int().nonnegative(),
})
export type ServerStartedDetail = z.infer<typeof ServerStartedDetailSchema>

export const ServerStoppedDetailSchema = z.object({
  port: z.number().int().nonnegative().optional(),
})
export type ServerStoppedDetail = z.infer<typeof ServerStoppedDetailSchema>

const ServerModuleErrorCodeSchema = z.custom<ServerModuleErrorCode>((value) =>
  Object.values(SERVER_MODULE_ERROR_CODES).includes(value as ServerModuleErrorCode),
)

export const ServerErrorDetailSchema = z.object({
  code: ServerModuleErrorCodeSchema,
  message: z.string().min(1),
})
export type ServerErrorDetail = z.infer<typeof ServerErrorDetailSchema>

export const ClientConnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  isReconnect: z.boolean(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type ClientConnectedDetail = z.infer<typeof ClientConnectedDetailSchema>

export const ClientDisconnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  code: z.number().int(),
  reason: z.string(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type ClientDisconnectedDetail = z.infer<typeof ClientDisconnectedDetailSchema>

export const ClientErrorDetailSchema = z.object({
  code: ServerModuleErrorCodeSchema,
  connectionId: z.string().min(1).optional(),
  message: z.string().optional(),
  pathname: z.string().optional(),
})
export type ClientErrorDetail = z.infer<typeof ClientErrorDetailSchema>
export const BRIDGE_UI_CORE_ID = 'ui_core'

const createModuleEvent = <TEvent extends string>(event: TEvent, detail?: unknown) =>
  detail === undefined
    ? {
        type: event,
      }
    : {
        type: event,
        detail,
      }

const createServer = ({
  trigger,
  onClientMessage,
  reportTransportError,
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

  const topicConnections = new Map<string, number>()
  const knownConnections = new Set<string>()
  const replayBuffers = new Map<string, Array<{ data: string; timestamp: number }>>()
  const maxBufferSize = replayBufferOpts?.maxSize ?? 32
  const bufferTtlMs = replayBufferOpts?.ttlMs ?? 5_000

  const topicFor = (data: WebSocketData) =>
    data.source === 'document' ? data.connectionId : `${data.connectionId}:${data.source}`
  const uiWebsocketRuntimeActor = createUiWebsocketRuntimeActor({
    uiCoreTargetId: BRIDGE_UI_CORE_ID,
    serverSourceActorId: `module:${SERVER_MODULE_ID}`,
    serverSourceModuleId: SERVER_MODULE_ID,
  })
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
          createModuleEvent(
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
        const topic = topicFor(ws.data)
        const routed = uiWebsocketRuntimeActor.routeIngressMessage({
          connectionId: ws.data.connectionId,
          protocol: ws.data.source,
          topic,
          rawMessage: String(message),
        })

        if (routed.status === 'rejected') {
          reportTransportError({
            code: SERVER_MODULE_ERROR_CODES.malformed_message,
            connectionId: ws.data.connectionId,
            message: routed.error,
          })
          return
        }

        try {
          onClientMessage(routed.message)
        } catch (error) {
          reportTransportError({
            code: SERVER_MODULE_ERROR_CODES.internal_error,
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
          createModuleEvent(
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
          reportTransportError({
            code: SERVER_MODULE_ERROR_CODES.not_found,
            pathname: url.pathname,
          })
          return securedResponse('Not Found', { status: 404 })
        }

        if (allowedOrigins) {
          const origin = request.headers.get('origin')
          if (!origin || !allowedOrigins.has(origin)) {
            reportTransportError({
              code: SERVER_MODULE_ERROR_CODES.origin_rejected,
            })
            return securedResponse(SERVER_MODULE_ERROR_CODES.origin_rejected, { status: 403 })
          }
        }

        const source = request.headers.get('sec-websocket-protocol')
        if (!source) {
          reportTransportError({
            code: SERVER_MODULE_ERROR_CODES.protocol_missing,
          })
          return securedResponse(SERVER_MODULE_ERROR_CODES.protocol_missing, { status: 400 })
        }

        const authenticated = await authenticateConnection({
          request,
          source,
        })
        if (!authenticated) {
          reportTransportError({
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

        reportTransportError({
          code: SERVER_MODULE_ERROR_CODES.upgrade_failed,
          connectionId: authenticated.connectionId,
        })
        return securedResponse(SERVER_MODULE_ERROR_CODES.upgrade_failed, { status: 400 })
      }

      reportTransportError({
        code: SERVER_MODULE_ERROR_CODES.not_found,
        pathname: url.pathname,
      })
      return securedResponse('Not Found', { status: 404 })
    },
    error(error) {
      reportTransportError({
        code: SERVER_MODULE_ERROR_CODES.internal_error,
        message: error.message,
      })
      return securedResponse('Internal Server Error', { status: 500 })
    },
  })

  const send = (topic: string, data: string) => {
    const routed = uiWebsocketRuntimeActor.routeEgressMessage({
      topic,
      rawMessage: data,
    })
    if (routed.status === 'rejected') {
      reportTransportError({
        code: SERVER_MODULE_ERROR_CODES.malformed_message,
        message: routed.error,
      })
      return
    }

    const payload = routed.serialized
    const activeConnections = topicConnections.get(topic) ?? 0
    if (activeConnections > 0) {
      server.publish(topic, payload)
      return
    }
    if (maxBufferSize === 0) {
      return
    }

    const current = replayBuffers.get(topic) ?? []
    current.push({ data: payload, timestamp: Date.now() })
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

export const serverModuleExtension = useExtension(
  SERVER_MODULE_ID,
  ({ bThread, bSync, extensions, trigger, reportSnapshot }) => {
    let liveServer: ServerHandle | null = null

    const reportTransportError: CreateServerOptions['reportTransportError'] = ({
      code,
      connectionId,
      message,
      pathname,
    }) => {
      const details = [
        `code=${code}`,
        ...(connectionId ? [`connectionId=${connectionId}`] : []),
        ...(pathname ? [`pathname=${pathname}`] : []),
        ...(message ? [`message=${message}`] : []),
      ].join(', ')

      reportSnapshot({
        kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
        id: SERVER_MODULE_ID,
        error: `WebSocket transport diagnostic (${details})`,
      })
    }

    const forwardClientMessage: CreateServerOptions['onClientMessage'] = (message) => {
      // This module emits a ui_core request envelope. Final ui_core:* events
      // require a ui_core extension to be installed in the same runtime.
      const { requestEvent } = extensions.request({
        extension: BRIDGE_UI_CORE_ID,
        type: message.type,
        detail: message.detail,
        purpose: `server_module websocket ingress: ${message.type}`,
        detailSchema: z.unknown(),
      })
      trigger(requestEvent)
    }

    const emitServerStopped = (port?: number) =>
      trigger(
        createModuleEvent(
          SERVER_MODULE_EVENTS.server_stopped,
          ServerStoppedDetailSchema.parse({
            ...(port !== undefined && { port }),
          }),
        ),
      )

    const emitServerError = (detail: unknown) =>
      trigger(createModuleEvent(SERVER_MODULE_EVENTS.server_error, ServerErrorDetailSchema.parse(detail)))

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
          onClientMessage: forwardClientMessage,
          reportTransportError,
          ...detail,
        })
        trigger(
          createModuleEvent(
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
            detailSchema: ServerStartDetailSchema,
            detailMatch: 'invalid',
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
            detailSchema: ServerStopDetailSchema,
            detailMatch: 'invalid',
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
            detailSchema: ServerSendDetailSchema,
            detailMatch: 'invalid',
          },
        }),
      ],
      repeat: true,
    })

    const parseBehavioralDetail = <TDetail>({
      eventType,
      schema,
      detail,
    }: {
      eventType: string
      schema: z.ZodType<TDetail>
      detail: unknown
    }): TDetail | null => {
      try {
        return schema.parse(detail)
      } catch (error) {
        if (!(error instanceof z.ZodError)) {
          throw error
        }

        const message = error.issues
          .map((issue) => {
            const path = issue.path.map((segment) => String(segment)).join('.') || '<root>'
            return `${path}: ${issue.message}`
          })
          .join('; ')

        reportSnapshot({
          kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
          id: SERVER_MODULE_ID,
          error: `Server module event "${eventType}" rejected: ${message}`,
        })
        return null
      }
    }

    return {
      [SERVER_MODULE_EVENTS.server_start](detail: ServerStartDetail) {
        const parsed = parseBehavioralDetail({
          eventType: SERVER_MODULE_EVENTS.server_start,
          schema: ServerStartDetailSchema,
          detail,
        })
        if (parsed === null) {
          return
        }
        startServer(parsed)
      },
      [SERVER_MODULE_EVENTS.server_stop](detail: ServerStopDetail) {
        const parsed = parseBehavioralDetail({
          eventType: SERVER_MODULE_EVENTS.server_stop,
          schema: ServerStopDetailSchema,
          detail,
        })
        if (parsed === null) {
          return
        }
        stopServer(parsed)
      },
      [SERVER_MODULE_EVENTS.server_send](detail: ServerSendDetail) {
        const parsed = parseBehavioralDetail({
          eventType: SERVER_MODULE_EVENTS.server_send,
          schema: ServerSendDetailSchema,
          detail,
        })
        if (parsed === null) {
          return
        }
        if (!liveServer) {
          emitServerError({
            code: SERVER_MODULE_ERROR_CODES.server_not_running,
            message: 'Cannot send server message because no server is currently running.',
          })
          return
        }
        liveServer.send(parsed.topic, parsed.data)
      },
    }
  },
)
