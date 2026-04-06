import { A2A_METHOD, AGENT_CARD_PATH } from './a2a.constants.ts'
import type {
  AgentCard,
  JsonRpcErrorResponse,
  Message,
  MessageSendParams,
  Task,
  TaskIdParams,
  TaskPushNotificationConfig,
  TaskQueryParams,
} from './a2a.schemas.ts'
import { AgentCardSchema } from './a2a.schemas.ts'
import type { A2AClient, CreateA2AClientOptions, StreamEvent } from './a2a.types.ts'
import { A2AError, jsonRpcRequest, parseSSEStream } from './a2a.utils.ts'

/**
 * Creates an outbound A2A client for communicating with remote agents.
 *
 * @remarks
 * Uses `fetch()` with Bun extensions for Unix socket and mTLS support.
 * Each operation is a JSON-RPC 2.0 POST to the remote agent's `/a2a` endpoint.
 *
 * Streaming operations (`sendStreamingMessage`, `subscribeToTask`) return
 * `AsyncIterable<StreamEvent>` by consuming the SSE response body.
 *
 * @param options - Client configuration (URL, transport, auth headers)
 * @returns A2A client with all operations
 *
 * @public
 */
export const createA2AClient = (options: CreateA2AClientOptions): A2AClient => {
  const { url, unix, tls, headers: extraHeaders } = options
  const a2aUrl = `${url}/a2a`
  let requestCounter = 0
  const activeControllers = new Set<AbortController>()

  /** Build fetch options with transport extensions */
  const fetchOptions = (
    body: unknown,
    signal?: AbortSignal,
    accept?: string,
  ): RequestInit & Record<string, unknown> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }
    if (accept) headers.Accept = accept

    const opts: RequestInit & Record<string, unknown> = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    }

    if (unix) opts.unix = unix
    if (tls) opts.tls = tls

    return opts
  }

  /** Send a JSON-RPC request and parse the response */
  const rpcCall = async (method: string, params: unknown): Promise<unknown> => {
    const id = ++requestCounter
    const request = jsonRpcRequest(method, params, id)
    const response = await fetch(a2aUrl, fetchOptions(request))
    if (!response.ok) {
      throw A2AError.internalError(`HTTP ${response.status}: ${response.statusText}`)
    }
    const json = (await response.json()) as Record<string, unknown>

    // Check for error first — z.unknown() in success schema accepts missing 'result'
    if ('error' in json && json.error) {
      throw A2AError.fromResponse(json as unknown as JsonRpcErrorResponse)
    }

    return json.result
  }

  /** Send a JSON-RPC request and return SSE stream */
  async function* rpcStream(method: string, params: unknown, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const controller = new AbortController()
    activeControllers.add(controller)

    // Link external signal
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const id = ++requestCounter
      const request = jsonRpcRequest(method, params, id)
      const response = await fetch(a2aUrl, fetchOptions(request, controller.signal, 'text/event-stream'))
      if (!response.ok) {
        throw A2AError.internalError(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Server may return JSON error instead of SSE for unsupported operations
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const json = (await response.json()) as Record<string, unknown>
        if ('error' in json && json.error) {
          throw A2AError.fromResponse(json as unknown as JsonRpcErrorResponse)
        }
        return
      }

      if (!response.body) {
        throw A2AError.internalError('No response body for streaming request')
      }

      for await (const event of parseSSEStream(response.body, controller.signal)) {
        // Each SSE frame contains a JSON-RPC response wrapping the event
        const rpcEvent = event as Record<string, unknown>
        if ('error' in rpcEvent && rpcEvent.error) {
          throw A2AError.fromResponse(rpcEvent as unknown as JsonRpcErrorResponse)
        }
        yield rpcEvent.result as StreamEvent
      }
    } finally {
      activeControllers.delete(controller)
    }
  }

  return {
    sendMessage: (params: MessageSendParams) => rpcCall(A2A_METHOD['message/send'], params) as Promise<Task | Message>,

    sendStreamingMessage: (params: MessageSendParams, signal?: AbortSignal) =>
      rpcStream(A2A_METHOD['message/stream'], params, signal),

    getTask: (params: TaskQueryParams) => rpcCall(A2A_METHOD['tasks/get'], params) as Promise<Task>,

    cancelTask: (params: TaskIdParams) => rpcCall(A2A_METHOD['tasks/cancel'], params) as Promise<Task>,

    subscribeToTask: (params: TaskIdParams, signal?: AbortSignal) =>
      rpcStream(A2A_METHOD['tasks/resubscribe'], params, signal),

    getExtendedAgentCard: () => rpcCall(A2A_METHOD['agent/authenticatedExtendedCard'], {}) as Promise<AgentCard>,

    setPushConfig: (params: TaskPushNotificationConfig) =>
      rpcCall(A2A_METHOD['tasks/pushNotificationConfig/set'], params) as Promise<TaskPushNotificationConfig>,

    getPushConfig: (params: TaskIdParams) =>
      rpcCall(A2A_METHOD['tasks/pushNotificationConfig/get'], params) as Promise<TaskPushNotificationConfig>,

    listPushConfigs: (params: TaskIdParams) =>
      rpcCall(A2A_METHOD['tasks/pushNotificationConfig/list'], params) as Promise<TaskPushNotificationConfig[]>,

    deletePushConfig: async (params: TaskIdParams) => {
      await rpcCall(A2A_METHOD['tasks/pushNotificationConfig/delete'], params)
    },

    fetchAgentCard: async () => {
      const cardUrl = `${url}${AGENT_CARD_PATH}`
      const opts: RequestInit & Record<string, unknown> = { method: 'GET' }
      if (unix) opts.unix = unix
      if (tls) opts.tls = tls
      if (extraHeaders) opts.headers = extraHeaders

      const response = await fetch(cardUrl, opts)
      if (!response.ok) {
        throw A2AError.internalError(`HTTP ${response.status}: ${response.statusText}`)
      }
      const json = await response.json()
      return AgentCardSchema.parse(json)
    },

    disconnect: () => {
      for (const controller of activeControllers) {
        controller.abort()
      }
      activeControllers.clear()
    },
  }
}
