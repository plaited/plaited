import type { Server, TLSOptions } from 'bun'
import * as z from 'zod'

import type { Trigger } from '../behavioral.ts'
import { SNAPSHOT_MESSAGE_KINDS, useExtension } from '../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS } from '../bridge-events.ts'
import type { ClientMessage } from '../ui.ts'
import { AttrsMessageSchema, ClientMessageSchema, ImportModuleSchema, RenderMessageSchema } from '../ui.ts'
import { keyMirror } from '../utils.ts'

export const UI_WEBSOCKET_RUNTIME_ACTOR_ID = 'ui_websocket_runtime_actor'

export const UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS = keyMirror(
  'server_start',
  'server_stop',
  'server_send',
  'server_started',
  'server_stopped',
  'client_connected',
  'client_disconnected',
  'client_error',
)

export const UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES = keyMirror(
  'origin_rejected',
  'connection_rejected',
  'upgrade_failed',
  'malformed_message',
  'invalid_outbound_message',
  'protocol_missing',
  'not_found',
  'internal_error',
  'server_not_running',
)

export const UI_WEBSOCKET_RUNTIME_ACTOR_WEBSOCKET_PATH = '/ws'

export const UI_WEBSOCKET_RUNTIME_ACTOR_DEFAULT_CSP =
  "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"

export const toUiWebSocketRuntimeActorEventType = <TEvent extends string>(
  event: TEvent,
): `${typeof UI_WEBSOCKET_RUNTIME_ACTOR_ID}:${TEvent}` => `${UI_WEBSOCKET_RUNTIME_ACTOR_ID}:${event}`

export type UiWebSocketAuthenticatedConnection = {
  connectionId: string
  principalId?: string
  deviceId?: string
  capabilities?: string[]
}

export type UiWebSocketAuthenticateConnection = (input: {
  request: Request
  source: string
}) => UiWebSocketAuthenticatedConnection | Promise<UiWebSocketAuthenticatedConnection | null> | null

export const UiWebSocketDataSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})
export type UiWebSocketData = z.infer<typeof UiWebSocketDataSchema>

export const UiWebSocketReplayBufferOptionsSchema = z.object({
  maxSize: z.number().int().nonnegative().optional(),
  ttlMs: z.number().int().nonnegative().optional(),
})
export type UiWebSocketReplayBufferOptions = z.infer<typeof UiWebSocketReplayBufferOptionsSchema>

export const UiWebSocketLimitsSchema = z.object({
  idleTimeout: z.number().int().nonnegative().optional(),
  maxPayloadLength: z.number().int().nonnegative().optional(),
})
export type UiWebSocketLimits = z.infer<typeof UiWebSocketLimitsSchema>

export type UiWebSocketServeRoutes = Bun.Serve.Routes<UiWebSocketData, string>

export type UiWebSocketRuntimeActorErrorCode =
  (typeof UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES)[keyof typeof UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES]

export type UiIngressMessage = {
  message: ClientMessage
  connectionId: string
  source: string
  principalId?: string
  deviceId?: string
}

export type CreateUiWebSocketServerOptions = {
  trigger: Trigger
  onClientMessage: (message: UiIngressMessage) => void
  reportTransportError: (detail: {
    code: UiWebSocketRuntimeActorErrorCode
    connectionId?: string
    source?: string
    topic?: string
    message?: string
    pathname?: string
  }) => void
  routes: UiWebSocketServeRoutes
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
  authenticateConnection: UiWebSocketAuthenticateConnection
  wsLimits?: UiWebSocketLimits
  replayBuffer?: UiWebSocketReplayBufferOptions
  csp?: string | false
}

export type UiWebSocketServerHandle = {
  readonly server: Server<UiWebSocketData>
  readonly port: number
  send: (topic: string, data: string) => void
  stop: (closeActiveConnections?: boolean) => void
}

const DisconnectMessageSchema = z.object({
  type: z.literal(AGENT_TO_CONTROLLER_EVENTS.disconnect),
  detail: z.unknown().optional(),
})

const UiControllerServerMessageSchema = z.discriminatedUnion('type', [
  RenderMessageSchema,
  AttrsMessageSchema,
  ImportModuleSchema,
  DisconnectMessageSchema,
])

const ServeRoutesSchema = z.custom<UiWebSocketServeRoutes>((value) => value !== null && typeof value === 'object')
const AllowedOriginsSchema = z.custom<Set<string> | undefined>((value) => value === undefined || value instanceof Set)
const AuthenticateConnectionSchema = z.custom<UiWebSocketAuthenticateConnection>((value) => typeof value === 'function')
const TLSOptionsSchema = z.custom<Bun.TLSOptions>((_) => true)

export const UiWebSocketServerStartDetailSchema = z.object({
  routes: ServeRoutesSchema.default({}),
  port: z.number().int().nonnegative().default(0),
  tls: TLSOptionsSchema.optional(),
  allowedOrigins: AllowedOriginsSchema.optional(),
  authenticateConnection: AuthenticateConnectionSchema,
  wsLimits: UiWebSocketLimitsSchema.optional(),
  replayBuffer: UiWebSocketReplayBufferOptionsSchema.optional(),
  csp: z.union([z.string(), z.literal(false)]).optional(),
})
export type UiWebSocketServerStartDetail = z.infer<typeof UiWebSocketServerStartDetailSchema>

export const UiWebSocketServerStopDetailSchema = z
  .object({
    closeActiveConnections: z.boolean().optional(),
  })
  .optional()
export type UiWebSocketServerStopDetail = z.infer<typeof UiWebSocketServerStopDetailSchema>

export const UiWebSocketServerSendDetailSchema = z.object({
  topic: z.string().min(1),
  data: z.string(),
})
export type UiWebSocketServerSendDetail = z.infer<typeof UiWebSocketServerSendDetailSchema>

export const UiWebSocketServerStartedDetailSchema = z.object({
  port: z.number().int().nonnegative(),
})
export type UiWebSocketServerStartedDetail = z.infer<typeof UiWebSocketServerStartedDetailSchema>

export const UiWebSocketServerStoppedDetailSchema = z.object({
  port: z.number().int().nonnegative().optional(),
})
export type UiWebSocketServerStoppedDetail = z.infer<typeof UiWebSocketServerStoppedDetailSchema>

const UiWebSocketRuntimeActorErrorCodeSchema = z.custom<UiWebSocketRuntimeActorErrorCode>((value) =>
  Object.values(UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES).includes(value as UiWebSocketRuntimeActorErrorCode),
)

export const UiWebSocketClientConnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  isReconnect: z.boolean(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type UiWebSocketClientConnectedDetail = z.infer<typeof UiWebSocketClientConnectedDetailSchema>

export const UiWebSocketClientDisconnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  code: z.number().int(),
  reason: z.string(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type UiWebSocketClientDisconnectedDetail = z.infer<typeof UiWebSocketClientDisconnectedDetailSchema>

export const UiWebSocketClientErrorDetailSchema = z.object({
  code: UiWebSocketRuntimeActorErrorCodeSchema,
  connectionId: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  message: z.string().optional(),
  pathname: z.string().optional(),
})
export type UiWebSocketClientErrorDetail = z.infer<typeof UiWebSocketClientErrorDetailSchema>

export const BRIDGE_UI_CORE_ID = 'ui_core'

const createActorEvent = <TEvent extends string>(event: TEvent, detail?: unknown) =>
  detail === undefined
    ? {
        type: event,
      }
    : {
        type: event,
        detail,
      }

const formatValidationError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map((segment) => String(segment)).join('.') || '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')

const validateOutboundUiMessage = ({ data }: { data: string }): string | null => {
  let payload: unknown
  try {
    payload = JSON.parse(data)
  } catch (error) {
    return `outbound ui websocket payload must be valid JSON: ${error instanceof Error ? error.message : String(error)}`
  }

  try {
    UiControllerServerMessageSchema.parse(payload)
    return null
  } catch (error) {
    if (error instanceof z.ZodError) {
      return `outbound ui websocket payload rejected: ${formatValidationError(error)}`
    }

    return `outbound ui websocket payload rejected: ${error instanceof Error ? error.message : String(error)}`
  }
}

const createUiWebSocketServer = ({
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
}: CreateUiWebSocketServerOptions): UiWebSocketServerHandle => {
  const csp = cspOpt === false ? undefined : (cspOpt ?? UI_WEBSOCKET_RUNTIME_ACTOR_DEFAULT_CSP)
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

  const topicFor = (data: UiWebSocketData) =>
    data.source === 'document' ? data.connectionId : `${data.connectionId}:${data.source}`
  const hasRoutes = Object.keys(routes).length > 0

  const server = Bun.serve({
    port,
    tls,
    ...(hasRoutes && { routes }),
    websocket: {
      idleTimeout: wsLimits?.idleTimeout ?? 120,
      maxPayloadLength: wsLimits?.maxPayloadLength ?? 1_048_576,
      data: {} as UiWebSocketData,
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
          createActorEvent(
            UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_connected,
            UiWebSocketClientConnectedDetailSchema.parse({
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
            code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
            connectionId: ws.data.connectionId,
            source: ws.data.source,
            message: error instanceof Error ? error.message : String(error),
          })
          return
        }

        let parsedMessage: ClientMessage
        try {
          parsedMessage = ClientMessageSchema.parse(payload)
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportTransportError({
              code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
              connectionId: ws.data.connectionId,
              source: ws.data.source,
              message: formatValidationError(error),
            })
            return
          }

          throw error
        }

        try {
          onClientMessage({
            message: parsedMessage,
            connectionId: ws.data.connectionId,
            source: ws.data.source,
            principalId: ws.data.principalId,
            deviceId: ws.data.deviceId,
          })
        } catch (error) {
          reportTransportError({
            code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.internal_error,
            connectionId: ws.data.connectionId,
            source: ws.data.source,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      },
      close(ws, code, reason) {
        const { connectionId, source, principalId, deviceId } = ws.data
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
          createActorEvent(
            UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_disconnected,
            UiWebSocketClientDisconnectedDetailSchema.parse({
              connectionId,
              source,
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
        if (url.pathname !== UI_WEBSOCKET_RUNTIME_ACTOR_WEBSOCKET_PATH) {
          reportTransportError({
            code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.not_found,
            pathname: url.pathname,
          })
          return securedResponse('Not Found', { status: 404 })
        }

        if (allowedOrigins) {
          const origin = request.headers.get('origin')
          if (!origin || !allowedOrigins.has(origin)) {
            reportTransportError({
              code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.origin_rejected,
            })
            return securedResponse(UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.origin_rejected, { status: 403 })
          }
        }

        const source = request.headers.get('sec-websocket-protocol')
        if (!source) {
          reportTransportError({
            code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.protocol_missing,
          })
          return securedResponse(UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.protocol_missing, { status: 400 })
        }

        const authenticated = await authenticateConnection({
          request,
          source,
        })
        if (!authenticated) {
          reportTransportError({
            code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.connection_rejected,
          })
          return securedResponse(UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.connection_rejected, { status: 401 })
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
          code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.upgrade_failed,
          connectionId: authenticated.connectionId,
          source,
        })
        return securedResponse(UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.upgrade_failed, { status: 400 })
      }

      reportTransportError({
        code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.not_found,
        pathname: url.pathname,
      })
      return securedResponse('Not Found', { status: 404 })
    },
    error(error) {
      reportTransportError({
        code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.internal_error,
        message: error.message,
      })
      return securedResponse('Internal Server Error', { status: 500 })
    },
  })

  const send = (topic: string, data: string) => {
    const payloadError = validateOutboundUiMessage({ data })
    if (payloadError) {
      reportTransportError({
        code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_outbound_message,
        topic,
        message: payloadError,
      })
      return
    }

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
    throw new Error('UI websocket runtime actor started without a resolved listening port.')
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

export const uiWebSocketRuntimeActorExtension = useExtension(
  UI_WEBSOCKET_RUNTIME_ACTOR_ID,
  ({ extensions, trigger, reportSnapshot }) => {
    let liveServer: UiWebSocketServerHandle | null = null

    const emitClientError = (detail: unknown) =>
      trigger(
        createActorEvent(
          UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_error,
          UiWebSocketClientErrorDetailSchema.parse(detail),
        ),
      )

    const reportTransportError: CreateUiWebSocketServerOptions['reportTransportError'] = ({
      code,
      connectionId,
      source,
      topic,
      message,
      pathname,
    }) => {
      const details = [
        `code=${code}`,
        ...(connectionId ? [`connectionId=${connectionId}`] : []),
        ...(source ? [`source=${source}`] : []),
        ...(topic ? [`topic=${topic}`] : []),
        ...(pathname ? [`pathname=${pathname}`] : []),
        ...(message ? [`message=${message}`] : []),
      ].join(', ')

      reportSnapshot({
        kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
        id: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
        error: `UI websocket transport diagnostic (${details})`,
      })

      emitClientError({
        code,
        ...(connectionId !== undefined && { connectionId }),
        ...(source !== undefined && { source }),
        ...(topic !== undefined && { topic }),
        ...(message !== undefined && { message }),
        ...(pathname !== undefined && { pathname }),
      })
    }

    const forwardClientMessage: CreateUiWebSocketServerOptions['onClientMessage'] = ({
      message,
      source,
      connectionId,
    }) => {
      // This actor emits ui_core request envelopes. Final ui_core:* events
      // require a ui_core extension to be installed in the same runtime.
      const { requestEvent } = extensions.request({
        extension: BRIDGE_UI_CORE_ID,
        type: message.type,
        detail: message.detail,
        purpose: `ui websocket ingress (${source}) for connection ${connectionId}: ${message.type}`,
        detailSchema: z.unknown(),
      })
      trigger(requestEvent)
    }

    const emitServerStopped = (port?: number) =>
      trigger(
        createActorEvent(
          UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_stopped,
          UiWebSocketServerStoppedDetailSchema.parse({
            ...(port !== undefined && { port }),
          }),
        ),
      )

    const reportActorDiagnostic = ({ code, message }: { code: UiWebSocketRuntimeActorErrorCode; message: string }) => {
      reportSnapshot({
        kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
        id: UI_WEBSOCKET_RUNTIME_ACTOR_ID,
        error: `UI websocket runtime actor diagnostic (code=${code}, message=${message})`,
      })
    }

    const stopServer = (detail?: UiWebSocketServerStopDetail) => {
      const closeActiveConnections = detail?.closeActiveConnections ?? true
      const activePort = liveServer?.port
      if (liveServer) {
        liveServer.stop(closeActiveConnections)
        liveServer = null
      }
      emitServerStopped(activePort)
    }

    const startServer = (detail: UiWebSocketServerStartDetail) => {
      if (liveServer) {
        stopServer({
          closeActiveConnections: true,
        })
      }

      try {
        liveServer = createUiWebSocketServer({
          trigger,
          onClientMessage: forwardClientMessage,
          reportTransportError,
          ...detail,
        })
        trigger(
          createActorEvent(
            UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_started,
            UiWebSocketServerStartedDetailSchema.parse({
              port: liveServer.port,
            }),
          ),
        )
      } catch (error) {
        liveServer = null
        reportActorDiagnostic({
          code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.internal_error,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      [UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_start](detail: unknown) {
        startServer(UiWebSocketServerStartDetailSchema.parse(detail))
      },
      [UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_stop](detail: unknown) {
        stopServer(UiWebSocketServerStopDetailSchema.parse(detail))
      },
      [UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_send](detail: unknown) {
        const parsedDetail: UiWebSocketServerSendDetail = UiWebSocketServerSendDetailSchema.parse(detail)

        if (!liveServer) {
          reportActorDiagnostic({
            code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.server_not_running,
            message: 'Cannot send UI websocket message because no UI websocket runtime actor is currently running.',
          })
          return
        }

        liveServer.send(parsedDetail.topic, parsedDetail.data)
      },
    }
  },
)
