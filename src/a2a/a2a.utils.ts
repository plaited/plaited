import { A2A_ERROR_CODE } from './a2a.constants.ts'
import type {
  AgentCard,
  JsonRpcErrorResponse,
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  PushNotificationConfig,
} from './a2a.schemas.ts'

// ============================================================================
// SSE Encoding
// ============================================================================

/**
 * Format a value as an SSE data frame.
 *
 * @remarks
 * Produces `data: {json}\n\n` — the standard SSE format for normal events.
 *
 * @public
 */
export const formatSSE = (data: unknown): string => `data: ${JSON.stringify(data)}\n\n`

/**
 * Format a value as an SSE error event.
 *
 * @remarks
 * Produces `event: error\ndata: {json}\n\n` per A2A SSE convention.
 *
 * @public
 */
export const formatSSEError = (error: unknown): string => `event: error\ndata: ${JSON.stringify(error)}\n\n`

// ============================================================================
// SSE Parsing
// ============================================================================

/**
 * Parse an SSE stream into yielded JSON objects.
 *
 * @remarks
 * Handles chunked delivery — SSE frame boundaries may not align with
 * `ReadableStream` chunks. Buffers partial lines and yields parsed
 * JSON from `data:` fields when a blank line (frame terminator) is seen.
 *
 * Ignores `event:` lines (used only for `error` typing on the wire).
 * Non-`data:` lines are silently skipped per the SSE spec.
 *
 * @param body - The response body stream
 * @param signal - Optional abort signal to cancel parsing
 *
 * @public
 */
export async function* parseSSEStream(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on double newline (SSE frame boundary)
      let frameEnd = buffer.indexOf('\n\n')
      while (frameEnd !== -1) {
        const frame = buffer.slice(0, frameEnd)
        buffer = buffer.slice(frameEnd + 2)

        // Extract data lines from the frame
        const lines = frame.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ') || line.startsWith('data:')) {
            const jsonStr = line.startsWith('data: ') ? line.slice(6) : line.slice(5)
            if (jsonStr.trim()) {
              yield JSON.parse(jsonStr)
            }
          }
          // event: lines and other fields are ignored
        }
        frameEnd = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ============================================================================
// JSON-RPC 2.0 Framing
// ============================================================================

/**
 * Create a JSON-RPC 2.0 request envelope.
 *
 * @public
 */
export const jsonRpcRequest = (method: string, params: unknown, id: string | number): JsonRpcRequest =>
  ({
    jsonrpc: '2.0',
    id,
    method,
    params,
  }) as JsonRpcRequest

/**
 * Create a JSON-RPC 2.0 success response envelope.
 *
 * @public
 */
export const jsonRpcSuccess = (result: unknown, id: string | number): JsonRpcSuccessResponse => ({
  jsonrpc: '2.0',
  id,
  result,
})

/**
 * Create a JSON-RPC 2.0 error response envelope.
 *
 * @public
 */
export const jsonRpcError = (
  code: number,
  message: string,
  id: string | number | null,
  data?: unknown,
): JsonRpcErrorResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message, ...(data !== undefined && { data }) },
})

// ============================================================================
// Agent Card JWS Signing (ES256 / ECDSA P-256)
// ============================================================================

/** Base64url encode bytes (no padding) */
const base64url = (input: Uint8Array | ArrayBuffer): string => {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Base64url decode to ArrayBuffer */
const base64urlDecode = (str: string): ArrayBuffer => {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

/**
 * Sign an Agent Card using JWS compact serialization (ES256).
 *
 * @remarks
 * Uses Web Crypto ECDSA P-256. The card JSON (minus any existing `signature`
 * field) becomes the JWS payload. The compact JWS is stored in `card.signature.signature`.
 *
 * @param card - Agent Card to sign
 * @param privateKey - ECDSA P-256 private key (CryptoKey)
 * @returns New card object with `signature` field populated
 *
 * @public
 */
export const signAgentCard = async (card: AgentCard, privateKey: CryptoKey): Promise<AgentCard> => {
  // Remove existing signature for canonical payload
  const { signature: _, ...cardBody } = card
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256' })))
  const payload = base64url(new TextEncoder().encode(JSON.stringify(cardBody)))
  const signingInput = new TextEncoder().encode(`${header}.${payload}`)

  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signingInput)

  return {
    ...card,
    signature: {
      signature: `${header}.${payload}.${base64url(sig)}`,
      algorithm: 'ES256',
    },
  }
}

/**
 * Verify an Agent Card's JWS signature.
 *
 * @param card - Agent Card with `signature` field
 * @param publicKey - ECDSA P-256 public key (CryptoKey)
 * @returns `true` if signature is valid
 *
 * @public
 */
export const verifyAgentCardSignature = async (card: AgentCard, publicKey: CryptoKey): Promise<boolean> => {
  if (!card.signature?.signature) return false

  const parts = card.signature.signature.split('.')
  if (parts.length !== 3) return false

  const [header, payload, sig] = parts as [string, string, string]
  const signingInput = new TextEncoder().encode(`${header}.${payload}`)
  const sigBytes = base64urlDecode(sig)

  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBytes, signingInput)
}

// ============================================================================
// A2A Error Class
// ============================================================================

/**
 * Error class for A2A JSON-RPC errors.
 *
 * @remarks
 * Extends `Error` with JSON-RPC `code` and optional `data` fields.
 * The one class in this module — errors benefit from `instanceof` checks.
 *
 * @public
 */
export class A2AError extends Error {
  readonly code: number
  readonly data?: unknown

  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.name = 'A2AError'
    this.code = code
    this.data = data
  }

  /**
   * Create from a JSON-RPC error response.
   *
   * @internal
   */
  static fromResponse(response: JsonRpcErrorResponse): A2AError {
    return new A2AError(response.error.code, response.error.message, response.error.data)
  }

  /** Convenience factory for method-not-found errors */
  static methodNotFound(method: string): A2AError {
    return new A2AError(A2A_ERROR_CODE.method_not_found, `Method not found: ${method}`)
  }

  /** Convenience factory for invalid-params errors */
  static invalidParams(message: string): A2AError {
    return new A2AError(A2A_ERROR_CODE.invalid_params, message)
  }

  /** Convenience factory for internal errors */
  static internalError(message: string): A2AError {
    return new A2AError(A2A_ERROR_CODE.internal_error, message)
  }
}

// ============================================================================
// Push Notification Delivery
// ============================================================================

/**
 * Send a push notification to a registered webhook URL.
 *
 * @remarks
 * POSTs a JSON-RPC 2.0 response wrapping the event to the webhook `url`.
 * If the config includes a `token`, it is sent as a `Bearer` authorization
 * header. Returns `true` if the webhook responded with a 2xx status.
 *
 * @param config - The push notification config with webhook URL and optional token
 * @param event - The event payload to deliver (typically a `StreamEvent`)
 *
 * @public
 */
export const sendPushNotification = async (config: PushNotificationConfig, event: unknown): Promise<boolean> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`
  }

  const body = jsonRpcSuccess(event, 0)

  const response = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  return response.ok
}
