import type { Server, TLSOptions } from 'bun'
import * as z from 'zod'
import type { Trigger } from '../behavioral.ts'
import { ActorEnvelopeSchema, SNAPSHOT_MESSAGE_KINDS, useExtension } from '../behavioral.ts'
import type { ClientMessage } from '../ui.ts'
import { ClientMessageSchema } from '../ui.ts'
import { keyMirror } from '../utils.ts'

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
export const UI_WEBSOCKET_RUNTIME_ACTOR_ID = 'ui_websocket_runtime_actor'
export const INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID = 'inference_websocket_runtime_actor'
export const BRIDGE_UI_CORE_ID = 'ui_core'
export const BRIDGE_INFERENCE_CORE_ID = 'inference_bridge'
export const INFERENCE_WEBSOCKET_SOURCE = 'inference'
export const INFERENCE_WEBSOCKET_MESSAGE_TYPE = 'inference_envelope'

export const DEFAULT_CSP = "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"

export const toServerModuleEventType = <TEvent extends string>(event: TEvent): `${typeof SERVER_MODULE_ID}:${TEvent}` =>
  `${SERVER_MODULE_ID}:${event}`

const WebSocketRuntimeActorIdSchema = z.enum([UI_WEBSOCKET_RUNTIME_ACTOR_ID, INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID])
type WebSocketRuntimeActorId = z.infer<typeof WebSocketRuntimeActorIdSchema>

export const InferenceWebSocketMessageSchema = z.object({
  type: z.literal(INFERENCE_WEBSOCKET_MESSAGE_TYPE),
  detail: ActorEnvelopeSchema,
})
export type InferenceWebSocketMessage = z.infer<typeof InferenceWebSocketMessageSchema>

const WebSocketRuntimeIngressEnvelopeSchema = z.object({
  actorId: WebSocketRuntimeActorIdSchema,
  connectionId: z.string().min(1),
  source: z.string().min(1),
  messageType: z.string().min(1),
  messageDetail: z.unknown().optional(),
})
export type WebSocketRuntimeIngressEnvelope = z.infer<typeof WebSocketRuntimeIngressEnvelopeSchema>

export type ParseWebSocketRuntimeRouteInput = {
  connectionId: string
  source: string
  payload: unknown
}

export type WebSocketRuntimeRoute = {
  actorId: WebSocketRuntimeActorId
  extensionId: string
  type: string
  detail: unknown
  detailSchema: z.ZodType<unknown>
  purpose: string
  envelope: WebSocketRuntimeIngressEnvelope
}

const toIngressPurpose = ({ actorId, messageType }: { actorId: WebSocketRuntimeActorId; messageType: string }) =>
  `server_module websocket ingress (${actorId}): ${messageType}`

const toIngressEnvelope = ({
  actorId,
  connectionId,
  source,
  messageType,
  messageDetail,
}: {
  actorId: WebSocketRuntimeActorId
  connectionId: string
  source: string
  messageType: string
  messageDetail?: unknown
}) =>
  WebSocketRuntimeIngressEnvelopeSchema.parse({
    actorId,
    connectionId,
    source,
    messageType,
    ...(messageDetail !== undefined && { messageDetail }),
  })

const routeUiWebSocketIngress = ({
  connectionId,
  source,
  payload,
}: ParseWebSocketRuntimeRouteInput): WebSocketRuntimeRoute => {
  const parsedMessage: ClientMessage = ClientMessageSchema.parse(payload)
  const envelope = toIngressEnvelope({
    actorId: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
    connectionId,
    source,
    messageType: parsedMessage.type,
    messageDetail: parsedMessage.detail,
  })

  return {
    actorId: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
    extensionId: BRIDGE_UI_CORE_ID,
    type: parsedMessage.type,
    detail: parsedMessage.detail,
    detailSchema: z.unknown(),
    purpose: toIngressPurpose({
      actorId: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
      messageType: parsedMessage.type,
    }),
    envelope,
  }
}

const routeInferenceWebSocketIngress = ({
  connectionId,
  source,
  payload,
}: ParseWebSocketRuntimeRouteInput): WebSocketRuntimeRoute => {
  const parsedMessage = InferenceWebSocketMessageSchema.parse(payload)
  const envelope = toIngressEnvelope({
    actorId: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
    connectionId,
    source,
    messageType: parsedMessage.type,
    messageDetail: parsedMessage.detail,
  })

  return {
    actorId: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
    extensionId: BRIDGE_INFERENCE_CORE_ID,
    type: parsedMessage.type,
    detail: parsedMessage.detail,
    detailSchema: ActorEnvelopeSchema,
    purpose: toIngressPurpose({
      actorId: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
      messageType: parsedMessage.type,
    }),
    envelope,
  }
}

export const parseWebSocketRuntimeRoute = (input: ParseWebSocketRuntimeRouteInput): WebSocketRuntimeRoute => {
  if (input.source === INFERENCE_WEBSOCKET_SOURCE) {
    return routeInferenceWebSocketIngress(input)
  }

  return routeUiWebSocketIngress(input)
}

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
  onWebSocketIngress: (route: WebSocketRuntimeRoute) => void
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
  onWebSocketIngress,
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
        let payload: unknown
        try {
          payload = JSON.parse(String(message))
        } catch (error) {
          reportTransportError({
            code: SERVER_MODULE_ERROR_CODES.malformed_message,
            connectionId: ws.data.connectionId,
            message: error instanceof Error ? error.message : String(error),
          })
          return
        }

        let route: WebSocketRuntimeRoute
        try {
          route = parseWebSocketRuntimeRoute({
            connectionId: ws.data.connectionId,
            source: ws.data.source,
            payload,
          })
        } catch (error) {
          reportTransportError({
            code: SERVER_MODULE_ERROR_CODES.malformed_message,
            connectionId: ws.data.connectionId,
            message: error instanceof Error ? error.message : String(error),
          })
          return
        }

        try {
          onWebSocketIngress(route)
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

    const forwardWebSocketIngress: CreateServerOptions['onWebSocketIngress'] = (route) => {
      // This module emits actor-scoped request envelopes. Final extension-specific
      // events require the destination extension to be installed in the runtime.
      const { requestEvent } = extensions.request({
        extension: route.extensionId,
        type: route.type,
        detail: route.detail,
        purpose: route.purpose,
        detailSchema: route.detailSchema,
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

    const reportInternalIngressValidationError = ({ eventType, error }: { eventType: string; error: z.ZodError }) => {
      reportSnapshot({
        kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
        id: `${SERVER_MODULE_ID}:invalid_${eventType}`,
        error: `server_module internal ingress validation failed (${eventType}): ${error.message}`,
      })
    }

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
          onWebSocketIngress: forwardWebSocketIngress,
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

    return {
      [SERVER_MODULE_EVENTS.server_start](detail: ServerStartDetail) {
        try {
          startServer(ServerStartDetailSchema.parse(detail))
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportInternalIngressValidationError({
              eventType: SERVER_MODULE_EVENTS.server_start,
              error,
            })
            return
          }
          throw error
        }
      },
      [SERVER_MODULE_EVENTS.server_stop](detail: ServerStopDetail) {
        try {
          stopServer(ServerStopDetailSchema.parse(detail))
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportInternalIngressValidationError({
              eventType: SERVER_MODULE_EVENTS.server_stop,
              error,
            })
            return
          }
          throw error
        }
      },
      [SERVER_MODULE_EVENTS.server_send](detail: ServerSendDetail) {
        let parsed: ServerSendDetail
        try {
          parsed = ServerSendDetailSchema.parse(detail)
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportInternalIngressValidationError({
              eventType: SERVER_MODULE_EVENTS.server_send,
              error,
            })
            return
          }
          throw error
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
