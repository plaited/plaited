import type { ServerWebSocket, WebSocketHandler } from 'bun'
import { ZodError } from 'zod'
import { A2A_ERROR_CODE } from './a2a.constants.ts'
import {
  JsonRpcRequestSchema,
  MessageSendParamsSchema,
  TaskIdParamsSchema,
  TaskPushNotificationConfigSchema,
  TaskQueryParamsSchema,
} from './a2a.schemas.ts'
import type { A2AOperationHandlers } from './a2a.types.ts'
import { A2AError, jsonRpcError, jsonRpcSuccess } from './a2a.utils.ts'

// ============================================================================
// WebSocket Data (per-connection state)
// ============================================================================

/**
 * Per-connection state stored in `ws.data`.
 *
 * @public
 */
export type A2AWebSocketData = {
  identity?: string
  activeRequests: Map<string | number, AbortController>
}

// ============================================================================
// Module Options
// ============================================================================

/**
 * Options for {@link createA2AWebSocketHandler}.
 *
 * @public
 */
export type CreateA2AWebSocketHandlerOptions = {
  handlers: A2AOperationHandlers
  authenticate?: (request: Request) => Promise<string | undefined>
}

// ============================================================================
// Module
// ============================================================================

/**
 * Creates a WebSocket-based A2A handler for persistent bidirectional communication.
 *
 * @remarks
 * Returns `{ websocket, handleUpgrade }` for composition with `Bun.serve()`.
 * The `websocket` handler processes JSON-RPC 2.0 messages over the WebSocket
 * connection — same protocol as the HTTP binding but without per-request overhead.
 *
 * Streaming operations send multiple JSON-RPC responses with the same `id`.
 * Non-streaming operations send a single response.
 *
 * The caller is responsible for routing WebSocket upgrade requests to
 * `handleUpgrade` in their `fetch` handler.
 *
 * @param options - Handler configuration
 * @returns WebSocket handler and upgrade function
 *
 * @public
 */
export const createA2AWebSocketHandler = ({ handlers, authenticate }: CreateA2AWebSocketHandlerOptions) => {
  /** Send a JSON-RPC response over the WebSocket */
  const send = (ws: ServerWebSocket<A2AWebSocketData>, data: unknown) => {
    ws.send(JSON.stringify(data))
  }

  const websocket: WebSocketHandler<A2AWebSocketData> = {
    data: {} as A2AWebSocketData,

    open(ws) {
      ws.data.activeRequests = new Map()
    },

    async message(ws, message) {
      const raw = String(message)

      // ── Parse JSON-RPC request ──────────────────────────────────────
      let body: unknown
      try {
        body = JSON.parse(raw)
      } catch {
        send(ws, jsonRpcError(A2A_ERROR_CODE.parse_error, 'Parse error', null))
        return
      }

      const parsed = JsonRpcRequestSchema.safeParse(body)
      if (!parsed.success) {
        send(ws, jsonRpcError(A2A_ERROR_CODE.invalid_request, 'Invalid Request', null))
        return
      }

      const { method, params, id } = parsed.data

      // ── Create abort controller for this request ────────────────────
      const controller = new AbortController()
      ws.data.activeRequests.set(id, controller)

      // ── Dispatch by method ──────────────────────────────────────────
      try {
        switch (method) {
          case 'message/send': {
            const sendParams = MessageSendParamsSchema.parse(params)
            const result = await handlers.sendMessage(sendParams, controller.signal)
            send(ws, jsonRpcSuccess(result, id))
            break
          }

          case 'message/stream': {
            if (!handlers.sendStreamingMessage) {
              send(ws, jsonRpcError(A2A_ERROR_CODE.unsupported_operation, 'Streaming not supported', id))
              break
            }
            const streamParams = MessageSendParamsSchema.parse(params)
            for await (const event of handlers.sendStreamingMessage(streamParams, controller.signal)) {
              if (controller.signal.aborted) break
              send(ws, jsonRpcSuccess(event, id))
            }
            // Send stream completion sentinel so client doesn't hang
            // if the iterable ended without a final: true status-update
            send(ws, jsonRpcSuccess(null, id))
            break
          }

          case 'tasks/get': {
            if (!handlers.getTask) {
              send(ws, jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
              break
            }
            const queryParams = TaskQueryParamsSchema.parse(params)
            const result = await handlers.getTask(queryParams)
            send(ws, jsonRpcSuccess(result, id))
            break
          }

          case 'tasks/cancel': {
            if (!handlers.cancelTask) {
              send(ws, jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
              break
            }
            const cancelParams = TaskIdParamsSchema.parse(params)
            const result = await handlers.cancelTask(cancelParams)
            send(ws, jsonRpcSuccess(result, id))
            break
          }

          case 'tasks/resubscribe': {
            if (!handlers.subscribeToTask) {
              send(ws, jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
              break
            }
            const subParams = TaskIdParamsSchema.parse(params)
            for await (const event of handlers.subscribeToTask(subParams, controller.signal)) {
              if (controller.signal.aborted) break
              send(ws, jsonRpcSuccess(event, id))
            }
            // Send stream completion sentinel
            send(ws, jsonRpcSuccess(null, id))
            break
          }

          case 'agent/authenticatedExtendedCard': {
            if (!handlers.getExtendedAgentCard) {
              send(ws, jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
              break
            }
            const extCard = await handlers.getExtendedAgentCard()
            send(ws, jsonRpcSuccess(extCard, id))
            break
          }

          case 'tasks/pushNotificationConfig/set': {
            if (!handlers.setPushConfig) {
              send(
                ws,
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
              break
            }
            const setConfigParams = TaskPushNotificationConfigSchema.parse(params)
            const setResult = await handlers.setPushConfig(setConfigParams)
            send(ws, jsonRpcSuccess(setResult, id))
            break
          }

          case 'tasks/pushNotificationConfig/get': {
            if (!handlers.getPushConfig) {
              send(
                ws,
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
              break
            }
            const getConfigParams = TaskIdParamsSchema.parse(params)
            const getResult = await handlers.getPushConfig(getConfigParams)
            send(ws, jsonRpcSuccess(getResult, id))
            break
          }

          case 'tasks/pushNotificationConfig/list': {
            if (!handlers.listPushConfigs) {
              send(
                ws,
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
              break
            }
            const listConfigParams = TaskIdParamsSchema.parse(params)
            const listResult = await handlers.listPushConfigs(listConfigParams)
            send(ws, jsonRpcSuccess(listResult, id))
            break
          }

          case 'tasks/pushNotificationConfig/delete': {
            if (!handlers.deletePushConfig) {
              send(
                ws,
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
              break
            }
            const deleteConfigParams = TaskIdParamsSchema.parse(params)
            await handlers.deletePushConfig(deleteConfigParams)
            send(ws, jsonRpcSuccess(null, id))
            break
          }

          default:
            send(ws, jsonRpcError(A2A_ERROR_CODE.method_not_found, `Method not found: ${method}`, id))
        }
      } catch (error) {
        if (error instanceof A2AError) {
          send(ws, jsonRpcError(error.code, error.message, id, error.data))
        } else if (error instanceof ZodError) {
          send(ws, jsonRpcError(A2A_ERROR_CODE.invalid_params, error.message, id))
        } else {
          const msg = error instanceof Error ? error.message : String(error)
          send(ws, jsonRpcError(A2A_ERROR_CODE.internal_error, msg, id))
        }
      } finally {
        ws.data.activeRequests.delete(id)
      }
    },

    close(ws) {
      // Abort all in-flight requests for this connection
      for (const controller of ws.data.activeRequests.values()) {
        controller.abort()
      }
      ws.data.activeRequests.clear()
    },
  }

  /**
   * Upgrade an HTTP request to a WebSocket connection.
   *
   * @remarks
   * Call this in your `fetch` handler when the request path matches
   * your A2A WebSocket endpoint and the `Upgrade: websocket` header is present.
   *
   * @returns `undefined` on successful upgrade, or an error Response
   */
  const handleUpgrade = async (
    req: Request,
    upgrade: (req: Request, options: { data: A2AWebSocketData }) => boolean,
  ): Promise<Response | undefined> => {
    let identity: string | undefined
    if (authenticate) {
      try {
        identity = await authenticate(req)
      } catch {
        return Response.json(jsonRpcError(A2A_ERROR_CODE.unauthorized, 'Unauthorized', null), { status: 401 })
      }
    }

    const upgraded = upgrade(req, {
      data: { identity, activeRequests: new Map() },
    })

    if (upgraded) return undefined
    return new Response('WebSocket upgrade failed', { status: 400 })
  }

  return { websocket, handleUpgrade }
}
