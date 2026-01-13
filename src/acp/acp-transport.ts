/**
 * ACP stdio transport for subprocess communication.
 *
 * @remarks
 * Manages bidirectional JSON-RPC 2.0 communication with ACP agents over
 * stdin/stdout. Handles message framing, request/response correlation,
 * and notification streaming.
 *
 * The transport spawns the agent as a subprocess and communicates using
 * newline-delimited JSON messages with Zod runtime validation.
 */

import { JSON_RPC_ERRORS } from './acp.constants.ts'
import type {
  JsonRpcError,
  JsonRpcErrorResponse,
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccessResponse,
} from './acp.schemas.ts'
import { JsonRpcMessageSchema } from './acp.schemas.ts'

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

/** Bun FileSink for subprocess stdin */
type FileSink = {
  write: (data: string | ArrayBufferView | ArrayBuffer) => number
  flush: () => void
  end: () => void
}

/** Subprocess type with piped stdio (Bun.spawn return type) */
type PipedSubprocess = {
  stdin: FileSink
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  exited: Promise<number>
  kill: (signal?: number) => void
  pid: number
}

/** Custom error for ACP transport failures */
class ACPTransportError extends Error {
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
 * - Runtime validation of incoming messages via Zod
 */
export const createACPTransport = (config: ACPTransportConfig) => {
  const { command, cwd, env, timeout = 30000, onNotification, onRequest, onError, onClose } = config

  let subprocess: PipedSubprocess | undefined
  let nextId = 1
  const pendingRequests = new Map<string | number, PendingRequest>()
  let buffer = ''
  let isClosing = false

  // Stream readers for explicit cleanup
  let stdoutReader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let stderrReader: ReadableStreamDefaultReader<Uint8Array> | undefined

  // --------------------------------------------------------------------------
  // Message Parsing (with Zod validation)
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

      // Skip lines that don't look like JSON objects (debug output from adapters)
      if (!trimmed.startsWith('{')) continue

      try {
        const json = JSON.parse(trimmed)
        const result = JsonRpcMessageSchema.safeParse(json)

        if (!result.success) {
          // Only log if it looked like valid JSON but failed schema validation
          onError?.(new Error(`Invalid JSON-RPC message: ${result.error.message}`))
          continue
        }

        messages.push(result.data as JsonRpcMessage)
      } catch {
        // Silently skip non-JSON lines (common with debug output)
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

  const sendRaw = (message: JsonRpcMessage): void => {
    if (!subprocess || isClosing) {
      throw new ACPTransportError('Transport is not connected')
    }

    const json = `${JSON.stringify(message)}\n`
    subprocess.stdin.write(json)
    subprocess.stdin.flush()
  }

  const sendResponse = async (id: string | number, result: unknown): Promise<void> => {
    const response: JsonRpcSuccessResponse = {
      jsonrpc: '2.0',
      id,
      result,
    }
    sendRaw(response)
  }

  const sendErrorResponse = async (id: string | number, code: number, message: string): Promise<void> => {
    const response: JsonRpcErrorResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    }
    sendRaw(response)
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
      stdoutReader = subprocess!.stdout.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await stdoutReader.read()
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
      } finally {
        stdoutReader = undefined
      }
    }

    // Read stderr for debugging
    const readStderr = async () => {
      stderrReader = subprocess!.stderr.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await stderrReader.read()
          if (done) break
          // Log stderr for debugging but don't treat as error
          const text = decoder.decode(value, { stream: true })
          if (text.trim()) {
            console.error('[ACP Agent stderr]:', text.trim())
          }
        }
      } catch {
        // Ignore stderr read errors
      } finally {
        stderrReader = undefined
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
      sendRaw(rpcRequest)
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
    sendRaw(notification)
  }

  /**
   * Cancels a pending request using the ACP cancel notification.
   *
   * @param requestId - The ID of the request to cancel
   */
  const cancelRequest = async (requestId: string | number): Promise<void> => {
    // Use SDK's CancelRequestNotification format
    await notify('$/cancel_request', { requestId })
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
        // Try graceful shutdown - not in SDK, use string literal
        await request('shutdown').catch(() => {})
      }
    } finally {
      // Release stream readers to allow clean subprocess termination
      await Promise.all([stdoutReader?.cancel().catch(() => {}), stderrReader?.cancel().catch(() => {})])

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
