import { ZodError } from 'zod'
import { A2A_ERROR_CODE, AGENT_CARD_PATH, SSE_HEADERS } from './a2a.constants.ts'
import {
  JsonRpcRequestSchema,
  MessageSendParamsSchema,
  TaskIdParamsSchema,
  TaskPushNotificationConfigSchema,
  TaskQueryParamsSchema,
} from './a2a.schemas.ts'
import type { CreateA2AHandlerOptions } from './a2a.types.ts'
import { A2AError, formatSSE, formatSSEError, jsonRpcError, jsonRpcSuccess } from './a2a.utils.ts'

// ============================================================================
// Internal: SSE response from async iterable
// ============================================================================

/**
 * Wraps an async iterable into an SSE Response.
 *
 * @internal
 */
const sseResponse = (iterable: AsyncIterable<unknown>, id: string | number, controller: AbortController): Response => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(streamController) {
      try {
        for await (const event of iterable) {
          if (controller.signal.aborted) break
          const rpcResponse = jsonRpcSuccess(event, id)
          streamController.enqueue(encoder.encode(formatSSE(rpcResponse)))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const code = error instanceof A2AError ? error.code : A2A_ERROR_CODE.internal_error
        const rpcError = jsonRpcError(code, message, id)
        streamController.enqueue(encoder.encode(formatSSEError(rpcError)))
      } finally {
        streamController.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Creates A2A route handlers for composition with `Bun.serve()`.
 *
 * @remarks
 * Returns a `routes` object that the caller merges into their
 * `Bun.serve({ routes: {...handlers} })` configuration — the same composition pattern
 * as `createServer` in `src/factories/server-factory/`.
 *
 * Two routes are produced:
 * - `GET /.well-known/agent-card.json` — Agent Card discovery
 * - `POST /a2a` — JSON-RPC 2.0 dispatch for all A2A operations
 *
 * Streaming methods (`message/stream`, `tasks/resubscribe`) return
 * SSE responses. Non-streaming methods return JSON.
 *
 * @param options - Handler configuration
 * @returns Route map for Bun.serve()
 *
 * @public
 */
export const createA2AHandlers = ({ card, handlers, authenticate }: CreateA2AHandlerOptions) => {
  /** Resolve the Agent Card — supports both static value and dynamic getter */
  const resolveCard = typeof card === 'function' ? card : () => card

  return {
    [AGENT_CARD_PATH]: () => Response.json(resolveCard()),

    '/a2a': async (req: Request) => {
      if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
      }

      // ── Authentication ──────────────────────────────────────────────
      if (authenticate) {
        try {
          await authenticate(req)
        } catch {
          return Response.json(jsonRpcError(A2A_ERROR_CODE.unauthorized, 'Unauthorized', null), { status: 401 })
        }
      }

      // ── Parse JSON-RPC request ──────────────────────────────────────
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return Response.json(jsonRpcError(A2A_ERROR_CODE.parse_error, 'Parse error', null))
      }

      const parsed = JsonRpcRequestSchema.safeParse(body)
      if (!parsed.success) {
        return Response.json(jsonRpcError(A2A_ERROR_CODE.invalid_request, 'Invalid Request', null))
      }

      const { method, params, id } = parsed.data

      // ── Dispatch by method ──────────────────────────────────────────
      try {
        switch (method) {
          case 'message/send': {
            const sendParams = MessageSendParamsSchema.parse(params)
            const controller = new AbortController()
            req.signal.addEventListener('abort', () => controller.abort(), { once: true })
            const result = await handlers.sendMessage(sendParams, controller.signal)
            return Response.json(jsonRpcSuccess(result, id))
          }

          case 'message/stream': {
            if (!handlers.sendStreamingMessage) {
              return Response.json(jsonRpcError(A2A_ERROR_CODE.unsupported_operation, 'Streaming not supported', id))
            }
            const streamParams = MessageSendParamsSchema.parse(params)
            const controller = new AbortController()
            req.signal.addEventListener('abort', () => controller.abort(), { once: true })
            const iterable = handlers.sendStreamingMessage(streamParams, controller.signal)
            return sseResponse(iterable, id, controller)
          }

          case 'tasks/get': {
            if (!handlers.getTask) {
              return Response.json(jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
            }
            const queryParams = TaskQueryParamsSchema.parse(params)
            const result = await handlers.getTask(queryParams)
            return Response.json(jsonRpcSuccess(result, id))
          }

          case 'tasks/cancel': {
            if (!handlers.cancelTask) {
              return Response.json(jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
            }
            const cancelParams = TaskIdParamsSchema.parse(params)
            const result = await handlers.cancelTask(cancelParams)
            return Response.json(jsonRpcSuccess(result, id))
          }

          case 'tasks/resubscribe': {
            if (!handlers.subscribeToTask) {
              return Response.json(jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
            }
            const subParams = TaskIdParamsSchema.parse(params)
            const controller = new AbortController()
            req.signal.addEventListener('abort', () => controller.abort(), { once: true })
            const iterable = handlers.subscribeToTask(subParams, controller.signal)
            return sseResponse(iterable, id, controller)
          }

          case 'agent/authenticatedExtendedCard': {
            if (!handlers.getExtendedAgentCard) {
              return Response.json(jsonRpcError(A2A_ERROR_CODE.method_not_found, 'Method not found', id))
            }
            const extCard = await handlers.getExtendedAgentCard()
            return Response.json(jsonRpcSuccess(extCard, id))
          }

          case 'tasks/pushNotificationConfig/set': {
            if (!handlers.setPushConfig) {
              return Response.json(
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
            }
            const setConfigParams = TaskPushNotificationConfigSchema.parse(params)
            const setResult = await handlers.setPushConfig(setConfigParams)
            return Response.json(jsonRpcSuccess(setResult, id))
          }

          case 'tasks/pushNotificationConfig/get': {
            if (!handlers.getPushConfig) {
              return Response.json(
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
            }
            const getConfigParams = TaskIdParamsSchema.parse(params)
            const getResult = await handlers.getPushConfig(getConfigParams)
            return Response.json(jsonRpcSuccess(getResult, id))
          }

          case 'tasks/pushNotificationConfig/list': {
            if (!handlers.listPushConfigs) {
              return Response.json(
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
            }
            const listConfigParams = TaskIdParamsSchema.parse(params)
            const listResult = await handlers.listPushConfigs(listConfigParams)
            return Response.json(jsonRpcSuccess(listResult, id))
          }

          case 'tasks/pushNotificationConfig/delete': {
            if (!handlers.deletePushConfig) {
              return Response.json(
                jsonRpcError(A2A_ERROR_CODE.push_notification_not_supported, 'Push notifications not supported', id),
              )
            }
            const deleteConfigParams = TaskIdParamsSchema.parse(params)
            await handlers.deletePushConfig(deleteConfigParams)
            return Response.json(jsonRpcSuccess(null, id))
          }

          default:
            return Response.json(jsonRpcError(A2A_ERROR_CODE.method_not_found, `Method not found: ${method}`, id))
        }
      } catch (error) {
        if (error instanceof A2AError) {
          return Response.json(jsonRpcError(error.code, error.message, id, error.data))
        }
        if (error instanceof ZodError) {
          return Response.json(jsonRpcError(A2A_ERROR_CODE.invalid_params, error.message, id))
        }
        const message = error instanceof Error ? error.message : String(error)
        return Response.json(jsonRpcError(A2A_ERROR_CODE.internal_error, message, id))
      }
    },
  }
}
