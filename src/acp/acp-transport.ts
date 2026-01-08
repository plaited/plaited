/**
 * ACP stdio transport for subprocess communication.
 *
 * @remarks
 * Manages bidirectional JSON-RPC 2.0 communication with ACP agents over
 * stdin/stdout. Handles message framing, request/response correlation,
 * and notification streaming.
 *
 * The transport spawns the agent as a subprocess and communicates using
 * newline-delimited JSON messages.
 */

import type {
  CancelRequestParams,
  JsonRpcError,
  JsonRpcErrorResponse,
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
} from './acp.types.ts'
import { ACP_METHODS, JSON_RPC_ERRORS } from './acp.types.ts'

// ============================================================================
// Types
// ============================================================================

/** Configuration for the ACP transport */
export type ACPTransportConfig = {
  /** Command to spawn agent (e.g., ['claude', 'code', '--print-acp-config']) */
  command: string[]
  /** Working directory for agent process */
  cwd?: string
  /** Environment variables for agent process */
  env?: Record<string, string>
  /** Timeout for requests in milliseconds (default: 30000) */
  timeout?: number
  /** Callback for incoming notifications */
  onNotification?: (method: string, params: unknown) => void
  /** Callback for incoming requests (agent → client) */
  onRequest?: (method: string, params: unknown) => Promise<unknown>
  /** Callback for transport errors */
  onError?: (error: Error) => void
  /** Callback when transport closes */
  onClose?: (code: number | null) => void
}

/** Pending request tracker */
type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: Timer
}

/** Subprocess type with piped stdio */
type PipedSubprocess = {
  stdin: WritableStream<Uint8Array>
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  exited: Promise<number>
  kill: (signal?: number) => void
  pid: number
}

/** Custom error for ACP transport failures */
export class ACPTransportError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown,
  ) {
    super(message)
    this.name = 'ACPTransportError'
  }

  /** Create from JSON-RPC error */
  static fromJsonRpcError(error: JsonRpcError): ACPTransportError {
    return new ACPTransportError(error.message, error.code, error.data)
  }
}

// ============================================================================
// Transport Implementation
// ============================================================================

/**
 * Creates an ACP transport for subprocess communication.
 *
 * @param config - Transport configuration
 * @returns Transport object with send/close methods
 *
 * @remarks
 * The transport handles:
 * - Spawning the agent subprocess
 * - JSON-RPC message framing over stdio
 * - Request/response correlation with timeouts
 * - Notification and request routing
 * - Graceful shutdown
 */
export const createACPTransport = (config: ACPTransportConfig) => {
  const { command, cwd, env, timeout = 30000, onNotification, onRequest, onError, onClose } = config

  let subprocess: PipedSubprocess | undefined
  let nextId = 1
  const pendingRequests = new Map<string | number, PendingRequest>()
  let buffer = ''
  let isClosing = false

  // --------------------------------------------------------------------------
  // Message Parsing
  // --------------------------------------------------------------------------

  const parseMessages = (data: string): JsonRpcMessage[] => {
    buffer += data
    const messages: JsonRpcMessage[] = []
    const lines = buffer.split('\n')

    // Keep incomplete last line in buffer
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const parsed = JSON.parse(trimmed) as JsonRpcMessage
        messages.push(parsed)
      } catch {
        onError?.(new Error(`Failed to parse JSON-RPC message: ${trimmed.slice(0, 100)}`))
      }
    }

    return messages
  }

  // --------------------------------------------------------------------------
  // Message Handling
  // --------------------------------------------------------------------------

  const handleMessage = async (message: JsonRpcMessage) => {
    // Response to our request
    if (
      'id' in message &&
      message.id !== undefined &&
      message.id !== null &&
      ('result' in message || 'error' in message)
    ) {
      const response = message as JsonRpcResponse
      const id = response.id as string | number
      const pending = pendingRequests.get(id)
      if (pending) {
        pendingRequests.delete(id)
        clearTimeout(pending.timer)

        if ('error' in response) {
          pending.reject(ACPTransportError.fromJsonRpcError(response.error))
        } else {
          pending.resolve(response.result)
        }
      }
      return
    }

    // Request from agent (e.g., permission request, file read)
    if ('id' in message && message.id !== undefined && message.id !== null && 'method' in message) {
      const request = message as JsonRpcRequest
      const id = request.id as string | number
      if (onRequest) {
        try {
          const result = await onRequest(request.method, request.params)
          await sendResponse(id, result)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          await sendErrorResponse(id, JSON_RPC_ERRORS.INTERNAL_ERROR, error.message)
        }
      } else {
        // No handler, respond with method not found
        await sendErrorResponse(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `No handler for ${request.method}`)
      }
      return
    }

    // Notification from agent
    if ('method' in message && !('id' in message)) {
      const notification = message as JsonRpcNotification
      onNotification?.(notification.method, notification.params)
    }
  }

  // --------------------------------------------------------------------------
  // Sending Messages
  // --------------------------------------------------------------------------

  const sendRaw = async (message: JsonRpcMessage): Promise<void> => {
    if (!subprocess || isClosing) {
      throw new ACPTransportError('Transport is not connected')
    }

    const json = `${JSON.stringify(message)}\n`
    const writer = subprocess.stdin.getWriter()
    try {
      await writer.write(new TextEncoder().encode(json))
    } finally {
      writer.releaseLock()
    }
  }

  const sendResponse = async (id: string | number, result: unknown): Promise<void> => {
    const response: JsonRpcSuccessResponse = {
      jsonrpc: '2.0',
      id,
      result,
    }
    await sendRaw(response)
  }

  const sendErrorResponse = async (id: string | number, code: number, message: string): Promise<void> => {
    const response: JsonRpcErrorResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    }
    await sendRaw(response)
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Starts the transport by spawning the agent subprocess.
   *
   * @throws {ACPTransportError} If the subprocess fails to start
   */
  const start = async (): Promise<void> => {
    if (subprocess) {
      throw new ACPTransportError('Transport already started')
    }

    if (command.length === 0) {
      throw new ACPTransportError('Command array is empty')
    }

    const proc = Bun.spawn(command, {
      cwd,
      env: { ...Bun.env, ...env },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })

    // Cast to our expected type - Bun.spawn with 'pipe' options returns streams
    subprocess = proc as unknown as PipedSubprocess

    // Read stdout for JSON-RPC messages
    const readStdout = async () => {
      const reader = subprocess!.stdout.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          const messages = parseMessages(text)
          for (const message of messages) {
            await handleMessage(message)
          }
        }
      } catch (err) {
        if (!isClosing) {
          onError?.(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }

    // Read stderr for debugging
    const readStderr = async () => {
      const reader = subprocess!.stderr.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          // Log stderr for debugging but don't treat as error
          const text = decoder.decode(value, { stream: true })
          if (text.trim()) {
            console.error('[ACP Agent stderr]:', text.trim())
          }
        }
      } catch {
        // Ignore stderr read errors
      }
    }

    // Start reading streams
    readStdout()
    readStderr()

    // Monitor process exit
    subprocess.exited.then((code) => {
      if (!isClosing) {
        // Reject all pending requests
        for (const [id, pending] of pendingRequests) {
          clearTimeout(pending.timer)
          pending.reject(new ACPTransportError(`Process exited with code ${code}`))
          pendingRequests.delete(id)
        }
        onClose?.(code)
      }
    })
  }

  /**
   * Sends a JSON-RPC request and waits for response.
   *
   * @param method - The RPC method name
   * @param params - Optional parameters
   * @returns The result from the response
   * @throws {ACPTransportError} On timeout, transport error, or RPC error
   */
  const request = async <T>(method: string, params?: unknown): Promise<T> => {
    const id = nextId++

    const rpcRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined && { params }),
    }

    const { promise, resolve, reject } = Promise.withResolvers<unknown>()

    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new ACPTransportError(`Request timed out after ${timeout}ms`, JSON_RPC_ERRORS.INTERNAL_ERROR))
    }, timeout)

    pendingRequests.set(id, { resolve, reject, timer })

    try {
      await sendRaw(rpcRequest)
    } catch (err) {
      pendingRequests.delete(id)
      clearTimeout(timer)
      throw err
    }

    return promise as Promise<T>
  }

  /**
   * Sends a JSON-RPC notification (no response expected).
   *
   * @param method - The notification method name
   * @param params - Optional parameters
   */
  const notify = async (method: string, params?: unknown): Promise<void> => {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params }),
    }
    await sendRaw(notification)
  }

  /**
   * Cancels a pending request.
   *
   * @param requestId - The ID of the request to cancel
   */
  const cancelRequest = async (requestId: string | number): Promise<void> => {
    const params: CancelRequestParams = { id: requestId }
    await notify(ACP_METHODS.CANCEL_REQUEST, params)
  }

  /**
   * Closes the transport and terminates the subprocess.
   *
   * @param graceful - If true, sends shutdown request first (default: true)
   */
  const close = async (graceful = true): Promise<void> => {
    if (!subprocess || isClosing) return
    isClosing = true

    // Cancel all pending requests
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new ACPTransportError('Transport closed'))
      pendingRequests.delete(id)
    }

    try {
      if (graceful) {
        // Try graceful shutdown
        await request(ACP_METHODS.SHUTDOWN).catch(() => {})
      }
    } finally {
      subprocess.kill()
      subprocess = undefined
    }
  }

  /**
   * Checks if the transport is connected.
   */
  const isConnected = (): boolean => {
    return subprocess !== undefined && !isClosing
  }

  return {
    start,
    request,
    notify,
    cancelRequest,
    close,
    isConnected,
  }
}

/** Transport instance type */
export type ACPTransport = ReturnType<typeof createACPTransport>
