import { A2A_METHOD } from './a2a.constants.ts'
import type {
  AgentCard,
  JsonRpcErrorResponse,
  Message,
  MessageSendParams,
  Task,
  TaskIdParams,
  TaskQueryParams,
} from './a2a.schemas.ts'
import type { A2AClient, StreamEvent } from './a2a.types.ts'
import { A2AError, jsonRpcRequest } from './a2a.utils.ts'

// ============================================================================
// Factory Options
// ============================================================================

/**
 * Options for {@link createA2AWebSocketClient}.
 *
 * @param url - WebSocket URL (ws:// or wss://) of the remote agent
 * @param headers - Additional headers sent with the upgrade request (Bun extension)
 *
 * @public
 */
export type CreateA2AWebSocketClientOptions = {
  url: string
  headers?: Record<string, string>
}

// ============================================================================
// Internal types
// ============================================================================

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: A2AError) => void
}

type PendingStream = {
  push: (event: StreamEvent) => void
  done: () => void
  error: (err: A2AError) => void
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a persistent WebSocket A2A client.
 *
 * @remarks
 * Maintains a single WebSocket connection for all operations.
 * JSON-RPC request/response correlation is handled via the `id` field.
 *
 * Streaming operations (`sendStreamingMessage`, `subscribeToTask`) yield
 * events as they arrive. The stream ends when a `status-update` event
 * with `final: true` is received, or when the method completes on the
 * server side (no more messages for that `id`).
 *
 * The client waits for the WebSocket to open before sending. If the
 * connection closes unexpectedly, pending requests are rejected.
 *
 * @param options - Client configuration
 * @returns A2A client with all operations + disconnect
 *
 * @public
 */
export const createA2AWebSocketClient = (options: CreateA2AWebSocketClientOptions): A2AClient => {
  const { url, headers } = options
  let requestCounter = 0
  const pendingRequests = new Map<string | number, PendingRequest>()
  const pendingStreams = new Map<string | number, PendingStream>()

  // ── WebSocket connection ────────────────────────────────────────────
  // @ts-expect-error — Bun extends WebSocket constructor with headers option
  const ws = new WebSocket(url, { headers }) as WebSocket

  const ready = new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = (e) => reject(e)
  })

  ws.onmessage = (event) => {
    const json = JSON.parse(String(event.data)) as Record<string, unknown>
    const id = json.id as string | number

    // Error response
    if ('error' in json && json.error) {
      const err = A2AError.fromResponse(json as unknown as JsonRpcErrorResponse)
      const pending = pendingRequests.get(id)
      if (pending) {
        pending.reject(err)
        pendingRequests.delete(id)
        return
      }
      const stream = pendingStreams.get(id)
      if (stream) {
        stream.error(err)
        pendingStreams.delete(id)
        return
      }
      return
    }

    // Success response
    const result = json.result as Record<string, unknown>

    // Check if this is a streaming response
    const stream = pendingStreams.get(id)
    if (stream) {
      stream.push(result as unknown as StreamEvent)
      // Check for final status-update — signals end of stream
      if (result && result.kind === 'status-update' && result.final === true) {
        stream.done()
        pendingStreams.delete(id)
      }
      return
    }

    // Non-streaming response
    const pending = pendingRequests.get(id)
    if (pending) {
      pending.resolve(result)
      pendingRequests.delete(id)
    }
  }

  ws.onclose = () => {
    // Reject all pending requests
    const closeError = A2AError.internalError('WebSocket connection closed')
    for (const pending of pendingRequests.values()) {
      pending.reject(closeError)
    }
    pendingRequests.clear()
    for (const stream of pendingStreams.values()) {
      stream.error(closeError)
    }
    pendingStreams.clear()
  }

  // ── RPC helpers ─────────────────────────────────────────────────────

  /** Send a JSON-RPC request and wait for a single response */
  const rpcCall = async (method: string, params: unknown): Promise<unknown> => {
    await ready
    const id = ++requestCounter
    const request = jsonRpcRequest(method, params, id)

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject })
      ws.send(JSON.stringify(request))
    })
  }

  /** Send a JSON-RPC request and yield streaming responses */
  async function* rpcStream(method: string, params: unknown, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    await ready
    const id = ++requestCounter
    const request = jsonRpcRequest(method, params, id)

    // Create a buffered async iterable
    const buffer: StreamEvent[] = []
    let resolve: (() => void) | null = null
    let finished = false
    let streamError: A2AError | null = null

    pendingStreams.set(id, {
      push: (event) => {
        buffer.push(event)
        resolve?.()
      },
      done: () => {
        finished = true
        resolve?.()
      },
      error: (err) => {
        streamError = err
        finished = true
        resolve?.()
      },
    })

    ws.send(JSON.stringify(request))

    try {
      while (true) {
        if (signal?.aborted) break

        // Yield all buffered events
        while (buffer.length > 0) {
          yield buffer.shift()!
        }

        if (finished) {
          if (streamError) throw streamError
          break
        }

        // Wait for next event
        await new Promise<void>((r) => {
          resolve = r
        })
        resolve = null
      }
    } finally {
      pendingStreams.delete(id)
    }
  }

  // ── Client interface ────────────────────────────────────────────────

  return {
    sendMessage: (params: MessageSendParams) => rpcCall(A2A_METHOD['message/send'], params) as Promise<Task | Message>,

    sendStreamingMessage: (params: MessageSendParams, signal?: AbortSignal) =>
      rpcStream(A2A_METHOD['message/stream'], params, signal),

    getTask: (params: TaskQueryParams) => rpcCall(A2A_METHOD['tasks/get'], params) as Promise<Task>,

    cancelTask: (params: TaskIdParams) => rpcCall(A2A_METHOD['tasks/cancel'], params) as Promise<Task>,

    subscribeToTask: (params: TaskIdParams, signal?: AbortSignal) =>
      rpcStream(A2A_METHOD['tasks/resubscribe'], params, signal),

    getExtendedAgentCard: () => rpcCall(A2A_METHOD['agent/authenticatedExtendedCard'], {}) as Promise<AgentCard>,

    fetchAgentCard: () => {
      // Agent Card is served via HTTP GET, not WebSocket
      throw new A2AError(-32004, 'fetchAgentCard requires HTTP — use createA2AClient for Agent Card discovery')
    },

    disconnect: () => {
      ws.close()
    },
  }
}
