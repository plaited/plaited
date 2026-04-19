import type { Server, TLSOptions } from 'bun'
import * as z from 'zod'
import type { Trigger } from '../behavioral.ts'
import { type ActorEnvelope, ActorEnvelopeSchema, SNAPSHOT_MESSAGE_KINDS, useExtension } from '../behavioral.ts'
import { keyMirror } from '../utils.ts'

export const INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID = 'inference_websocket_runtime_actor'

export const INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS = keyMirror(
  'server_start',
  'server_stop',
  'envelope_send',
  'server_started',
  'server_stopped',
  'server_error',
  'client_connected',
  'client_disconnected',
  'client_error',
  'envelope_received',
)

export const INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES = keyMirror(
  'origin_rejected',
  'connection_rejected',
  'upgrade_failed',
  'malformed_message',
  'invalid_envelope',
  'protocol_missing',
  'not_found',
  'internal_error',
  'server_not_running',
  'invalid_control_event',
)

export const INFERENCE_WEBSOCKET_RUNTIME_ACTOR_WEBSOCKET_PATH = '/ws/inference'

export const INFERENCE_WEBSOCKET_RUNTIME_ACTOR_DEFAULT_CSP =
  "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"

export const toInferenceWebSocketRuntimeActorEventType = <TEvent extends string>(
  event: TEvent,
): `${typeof INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID}:${TEvent}` => `${INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID}:${event}`

export type InferenceWebSocketAuthenticatedConnection = {
  connectionId: string
  principalId?: string
  deviceId?: string
  capabilities?: string[]
}

export type InferenceWebSocketAuthenticateConnection = (input: {
  request: Request
  source: string
}) => InferenceWebSocketAuthenticatedConnection | Promise<InferenceWebSocketAuthenticatedConnection | null> | null

export const InferenceWebSocketDataSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})
export type InferenceWebSocketData = z.infer<typeof InferenceWebSocketDataSchema>

export const InferenceWebSocketReplayBufferOptionsSchema = z.object({
  maxSize: z.number().int().nonnegative().optional(),
  ttlMs: z.number().int().nonnegative().optional(),
})
export type InferenceWebSocketReplayBufferOptions = z.infer<typeof InferenceWebSocketReplayBufferOptionsSchema>

export const InferenceWebSocketLimitsSchema = z.object({
  idleTimeout: z.number().int().nonnegative().optional(),
  maxPayloadLength: z.number().int().nonnegative().optional(),
})
export type InferenceWebSocketLimits = z.infer<typeof InferenceWebSocketLimitsSchema>

export type InferenceWebSocketServeRoutes = Bun.Serve.Routes<InferenceWebSocketData, string>

export type InferenceWebSocketRuntimeActorErrorCode =
  (typeof INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES)[keyof typeof INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES]

export type InferenceIngressEnvelope = {
  envelope: ActorEnvelope
  connectionId: string
  source: string
  principalId?: string
  deviceId?: string
}

export type CreateInferenceWebSocketServerOptions = {
  trigger: Trigger
  onEnvelope: (message: InferenceIngressEnvelope) => void
  reportTransportError: (detail: {
    code: InferenceWebSocketRuntimeActorErrorCode
    connectionId?: string
    source?: string
    topic?: string
    message?: string
    pathname?: string
  }) => void
  routes: InferenceWebSocketServeRoutes
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
  authenticateConnection: InferenceWebSocketAuthenticateConnection
  wsLimits?: InferenceWebSocketLimits
  replayBuffer?: InferenceWebSocketReplayBufferOptions
  csp?: string | false
}

export type InferenceWebSocketServerHandle = {
  readonly server: Server<InferenceWebSocketData>
  readonly port: number
  send: (topic: string, envelope: ActorEnvelope) => void
  stop: (closeActiveConnections?: boolean) => void
}

const ServeRoutesSchema = z.custom<InferenceWebSocketServeRoutes>(
  (value) => value !== null && typeof value === 'object',
)
const AllowedOriginsSchema = z.custom<Set<string> | undefined>((value) => value === undefined || value instanceof Set)
const AuthenticateConnectionSchema = z.custom<InferenceWebSocketAuthenticateConnection>(
  (value) => typeof value === 'function',
)
const TLSOptionsSchema = z.custom<Bun.TLSOptions>((_) => true)

export const InferenceWebSocketServerStartDetailSchema = z.object({
  routes: ServeRoutesSchema.default({}),
  port: z.number().int().nonnegative().default(0),
  tls: TLSOptionsSchema.optional(),
  allowedOrigins: AllowedOriginsSchema.optional(),
  authenticateConnection: AuthenticateConnectionSchema,
  wsLimits: InferenceWebSocketLimitsSchema.optional(),
  replayBuffer: InferenceWebSocketReplayBufferOptionsSchema.optional(),
  csp: z.union([z.string(), z.literal(false)]).optional(),
})
export type InferenceWebSocketServerStartDetail = z.infer<typeof InferenceWebSocketServerStartDetailSchema>

export const InferenceWebSocketServerStopDetailSchema = z
  .object({
    closeActiveConnections: z.boolean().optional(),
  })
  .optional()
export type InferenceWebSocketServerStopDetail = z.infer<typeof InferenceWebSocketServerStopDetailSchema>

export const InferenceWebSocketEnvelopeSendDetailSchema = z.object({
  topic: z.string().min(1),
  envelope: ActorEnvelopeSchema,
})
export type InferenceWebSocketEnvelopeSendDetail = z.infer<typeof InferenceWebSocketEnvelopeSendDetailSchema>

export const InferenceWebSocketServerStartedDetailSchema = z.object({
  port: z.number().int().nonnegative(),
})
export type InferenceWebSocketServerStartedDetail = z.infer<typeof InferenceWebSocketServerStartedDetailSchema>

export const InferenceWebSocketServerStoppedDetailSchema = z.object({
  port: z.number().int().nonnegative().optional(),
})
export type InferenceWebSocketServerStoppedDetail = z.infer<typeof InferenceWebSocketServerStoppedDetailSchema>

const InferenceWebSocketRuntimeActorErrorCodeSchema = z.custom<InferenceWebSocketRuntimeActorErrorCode>((value) =>
  Object.values(INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES).includes(
    value as InferenceWebSocketRuntimeActorErrorCode,
  ),
)

export const InferenceWebSocketServerErrorDetailSchema = z.object({
  code: InferenceWebSocketRuntimeActorErrorCodeSchema,
  message: z.string().min(1),
})
export type InferenceWebSocketServerErrorDetail = z.infer<typeof InferenceWebSocketServerErrorDetailSchema>

export const InferenceWebSocketClientConnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  topic: z.string().min(1),
  isReconnect: z.boolean(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type InferenceWebSocketClientConnectedDetail = z.infer<typeof InferenceWebSocketClientConnectedDetailSchema>

export const InferenceWebSocketClientDisconnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  topic: z.string().min(1),
  code: z.number().int(),
  reason: z.string(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type InferenceWebSocketClientDisconnectedDetail = z.infer<
  typeof InferenceWebSocketClientDisconnectedDetailSchema
>

export const InferenceWebSocketClientErrorDetailSchema = z.object({
  code: InferenceWebSocketRuntimeActorErrorCodeSchema,
  connectionId: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  topic: z.string().min(1).optional(),
  message: z.string().optional(),
  pathname: z.string().optional(),
})
export type InferenceWebSocketClientErrorDetail = z.infer<typeof InferenceWebSocketClientErrorDetailSchema>

export const InferenceEnvelopeReceivedDetailSchema = z.object({
  envelope: ActorEnvelopeSchema,
  connectionId: z.string().min(1),
  source: z.string().min(1),
  topic: z.string().min(1),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type InferenceEnvelopeReceivedDetail = z.infer<typeof InferenceEnvelopeReceivedDetailSchema>

export const BRIDGE_INFERENCE_CORE_ID = 'inference_core'
export const INFERENCE_CORE_EVENTS = keyMirror('envelope_received')

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

const toTopic = ({ connectionId, source }: Pick<InferenceWebSocketData, 'connectionId' | 'source'>) =>
  `${connectionId}:${source}`

const createInferenceWebSocketServer = ({
  trigger,
  onEnvelope,
  reportTransportError,
  routes,
  port = 0,
  tls,
  allowedOrigins,
  authenticateConnection,
  wsLimits,
  replayBuffer: replayBufferOpts,
  csp: cspOpt,
}: CreateInferenceWebSocketServerOptions): InferenceWebSocketServerHandle => {
  const csp = cspOpt === false ? undefined : (cspOpt ?? INFERENCE_WEBSOCKET_RUNTIME_ACTOR_DEFAULT_CSP)
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
  const replayBuffers = new Map<string, Array<{ envelope: ActorEnvelope; timestamp: number }>>()
  const maxBufferSize = replayBufferOpts?.maxSize ?? 32
  const bufferTtlMs = replayBufferOpts?.ttlMs ?? 5_000

  const hasRoutes = Object.keys(routes).length > 0

  const server = Bun.serve({
    port,
    tls,
    ...(hasRoutes && { routes }),
    websocket: {
      idleTimeout: wsLimits?.idleTimeout ?? 120,
      maxPayloadLength: wsLimits?.maxPayloadLength ?? 1_048_576,
      data: {} as InferenceWebSocketData,
      open(ws) {
        const { connectionId, source, principalId, deviceId } = ws.data
        const topic = toTopic(ws.data)
        ws.subscribe(topic)
        topicConnections.set(topic, (topicConnections.get(topic) ?? 0) + 1)

        const buffer = replayBuffers.get(topic)
        if (buffer) {
          const now = Date.now()
          for (const entry of buffer) {
            if (now - entry.timestamp <= bufferTtlMs) {
              ws.sendText(JSON.stringify(entry.envelope))
            }
          }
          replayBuffers.delete(topic)
        }

        const isReconnect = knownConnections.has(connectionId)
        knownConnections.add(connectionId)
        trigger(
          createActorEvent(
            INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_connected,
            InferenceWebSocketClientConnectedDetailSchema.parse({
              connectionId,
              source,
              topic,
              isReconnect,
              principalId,
              deviceId,
            }),
          ),
        )
      },
      message(ws, message) {
        const topic = toTopic(ws.data)
        let payload: unknown
        try {
          payload = JSON.parse(String(message))
        } catch (error) {
          reportTransportError({
            code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
            connectionId: ws.data.connectionId,
            source: ws.data.source,
            topic,
            message: error instanceof Error ? error.message : String(error),
          })
          return
        }

        let envelope: ActorEnvelope
        try {
          envelope = ActorEnvelopeSchema.parse(payload)
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportTransportError({
              code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_envelope,
              connectionId: ws.data.connectionId,
              source: ws.data.source,
              topic,
              message: formatValidationError(error),
            })
            return
          }

          throw error
        }

        try {
          onEnvelope({
            envelope,
            connectionId: ws.data.connectionId,
            source: ws.data.source,
            principalId: ws.data.principalId,
            deviceId: ws.data.deviceId,
          })
        } catch (error) {
          reportTransportError({
            code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.internal_error,
            connectionId: ws.data.connectionId,
            source: ws.data.source,
            topic,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      },
      close(ws, code, reason) {
        const { connectionId, source, principalId, deviceId } = ws.data
        const topic = toTopic(ws.data)
        const count = topicConnections.get(topic) ?? 0
        if (count <= 1) {
          topicConnections.delete(topic)
        } else {
          topicConnections.set(topic, count - 1)
        }

        const hasRemainingConnections = [...topicConnections.keys()].some((candidate) =>
          candidate.startsWith(`${connectionId}:`),
        )
        if (!hasRemainingConnections) {
          setTimeout(() => {
            const stillConnected = [...topicConnections.keys()].some((candidate) =>
              candidate.startsWith(`${connectionId}:`),
            )
            if (stillConnected) {
              return
            }
            knownConnections.delete(connectionId)
            for (const key of replayBuffers.keys()) {
              if (key.startsWith(`${connectionId}:`)) {
                replayBuffers.delete(key)
              }
            }
          }, bufferTtlMs)
        }

        trigger(
          createActorEvent(
            INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_disconnected,
            InferenceWebSocketClientDisconnectedDetailSchema.parse({
              connectionId,
              source,
              topic,
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
        if (url.pathname !== INFERENCE_WEBSOCKET_RUNTIME_ACTOR_WEBSOCKET_PATH) {
          reportTransportError({
            code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.not_found,
            pathname: url.pathname,
          })
          return securedResponse('Not Found', { status: 404 })
        }

        if (allowedOrigins) {
          const origin = request.headers.get('origin')
          if (!origin || !allowedOrigins.has(origin)) {
            reportTransportError({
              code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.origin_rejected,
            })
            return securedResponse(INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.origin_rejected, { status: 403 })
          }
        }

        const source = request.headers.get('sec-websocket-protocol')
        if (!source) {
          reportTransportError({
            code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.protocol_missing,
          })
          return securedResponse(INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.protocol_missing, { status: 400 })
        }

        const authenticated = await authenticateConnection({
          request,
          source,
        })
        if (!authenticated) {
          reportTransportError({
            code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.connection_rejected,
          })
          return securedResponse(INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.connection_rejected, { status: 401 })
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
          code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.upgrade_failed,
          connectionId: authenticated.connectionId,
          source,
        })
        return securedResponse(INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.upgrade_failed, { status: 400 })
      }

      reportTransportError({
        code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.not_found,
        pathname: url.pathname,
      })
      return securedResponse('Not Found', { status: 404 })
    },
    error(error) {
      reportTransportError({
        code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.internal_error,
        message: error.message,
      })
      return securedResponse('Internal Server Error', { status: 500 })
    },
  })

  const send = (topic: string, envelope: ActorEnvelope) => {
    const activeConnections = topicConnections.get(topic) ?? 0
    if (activeConnections > 0) {
      server.publish(topic, JSON.stringify(envelope))
      return
    }

    if (maxBufferSize === 0) {
      return
    }

    const current = replayBuffers.get(topic) ?? []
    current.push({ envelope, timestamp: Date.now() })
    while (current.length > maxBufferSize) {
      current.shift()
    }
    replayBuffers.set(topic, current)
  }

  const resolvedPort = server.port
  if (resolvedPort === undefined) {
    server.stop(true)
    throw new Error('Inference websocket runtime actor started without a resolved listening port.')
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

export const inferenceWebSocketRuntimeActorExtension = useExtension(
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
  ({ extensions, trigger, reportSnapshot }) => {
    let liveServer: InferenceWebSocketServerHandle | null = null

    const emitClientError = (detail: unknown) =>
      trigger(
        createActorEvent(
          INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_error,
          InferenceWebSocketClientErrorDetailSchema.parse(detail),
        ),
      )

    const reportTransportError: CreateInferenceWebSocketServerOptions['reportTransportError'] = ({
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
        id: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
        error: `Inference websocket transport diagnostic (${details})`,
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

    const emitEnvelopeReceived = (detail: InferenceEnvelopeReceivedDetail) => {
      trigger(createActorEvent(INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.envelope_received, detail))

      const { requestEvent } = extensions.request({
        extension: BRIDGE_INFERENCE_CORE_ID,
        type: INFERENCE_CORE_EVENTS.envelope_received,
        detail,
        purpose: `inference websocket ingress (${detail.source}) for connection ${detail.connectionId}`,
        detailSchema: z.unknown(),
      })
      trigger(requestEvent)
    }

    const onEnvelope: CreateInferenceWebSocketServerOptions['onEnvelope'] = ({
      envelope,
      connectionId,
      source,
      principalId,
      deviceId,
    }) => {
      const detail = InferenceEnvelopeReceivedDetailSchema.parse({
        envelope,
        connectionId,
        source,
        topic: toTopic({ connectionId, source }),
        ...(principalId !== undefined && { principalId }),
        ...(deviceId !== undefined && { deviceId }),
      })

      // Preserve envelope source provenance for replay/supervisor workflows.
      emitEnvelopeReceived(detail)
    }

    const emitServerStopped = (port?: number) =>
      trigger(
        createActorEvent(
          INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_stopped,
          InferenceWebSocketServerStoppedDetailSchema.parse({
            ...(port !== undefined && { port }),
          }),
        ),
      )

    const emitServerError = (detail: unknown) =>
      trigger(
        createActorEvent(
          INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_error,
          InferenceWebSocketServerErrorDetailSchema.parse(detail),
        ),
      )

    const stopServer = (detail?: InferenceWebSocketServerStopDetail) => {
      const closeActiveConnections = detail?.closeActiveConnections ?? true
      const activePort = liveServer?.port
      if (liveServer) {
        liveServer.stop(closeActiveConnections)
        liveServer = null
      }
      emitServerStopped(activePort)
    }

    const startServer = (detail: InferenceWebSocketServerStartDetail) => {
      if (liveServer) {
        stopServer({
          closeActiveConnections: true,
        })
      }

      try {
        liveServer = createInferenceWebSocketServer({
          trigger,
          onEnvelope,
          reportTransportError,
          ...detail,
        })
        trigger(
          createActorEvent(
            INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_started,
            InferenceWebSocketServerStartedDetailSchema.parse({
              port: liveServer.port,
            }),
          ),
        )
      } catch (error) {
        liveServer = null
        emitServerError({
          code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.internal_error,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return {
      [INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_start](detail: unknown) {
        try {
          startServer(InferenceWebSocketServerStartDetailSchema.parse(detail))
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportTransportError({
              code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_control_event,
              message: `server_start rejected: ${formatValidationError(error)}`,
            })
            return
          }
          throw error
        }
      },
      [INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_stop](detail: unknown) {
        try {
          stopServer(InferenceWebSocketServerStopDetailSchema.parse(detail))
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportTransportError({
              code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_control_event,
              message: `server_stop rejected: ${formatValidationError(error)}`,
            })
            return
          }
          throw error
        }
      },
      [INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.envelope_send](detail: unknown) {
        let parsedDetail: InferenceWebSocketEnvelopeSendDetail
        try {
          parsedDetail = InferenceWebSocketEnvelopeSendDetailSchema.parse(detail)
        } catch (error) {
          if (error instanceof z.ZodError) {
            reportTransportError({
              code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_control_event,
              message: `envelope_send rejected: ${formatValidationError(error)}`,
            })
            return
          }
          throw error
        }

        if (!liveServer) {
          emitServerError({
            code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.server_not_running,
            message:
              'Cannot send inference websocket envelope because no inference websocket runtime actor is running.',
          })
          return
        }

        liveServer.send(parsedDetail.topic, parsedDetail.envelope)
      },
    }
  },
)
