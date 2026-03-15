import { describe, expect, test } from 'bun:test'
import { A2A_ERROR_CODE } from '../a2a.constants.ts'
import type { AgentCard } from '../a2a.schemas.ts'
import {
  A2AError,
  formatSSE,
  formatSSEError,
  jsonRpcError,
  jsonRpcRequest,
  jsonRpcSuccess,
  parseSSEStream,
  sendPushNotification,
  signAgentCard,
  verifyAgentCardSignature,
} from '../a2a.utils.ts'

// ── SSE Encoding ──────────────────────────────────────────────────────────────

describe('SSE Encoding', () => {
  test('formatSSE produces data frame', () => {
    const result = formatSSE({ type: 'test', value: 42 })
    expect(result).toBe('data: {"type":"test","value":42}\n\n')
  })

  test('formatSSE handles string data', () => {
    const result = formatSSE('hello')
    expect(result).toBe('data: "hello"\n\n')
  })

  test('formatSSEError produces error event frame', () => {
    const result = formatSSEError({ code: -32600, message: 'Bad request' })
    expect(result).toBe('event: error\ndata: {"code":-32600,"message":"Bad request"}\n\n')
  })
})

// ── SSE Parsing ───────────────────────────────────────────────────────────────

describe('SSE Parsing', () => {
  /** Create a ReadableStream from SSE-formatted strings */
  const sseStream = (...frames: string[]): ReadableStream<Uint8Array> => {
    const encoder = new TextEncoder()
    return new ReadableStream({
      start(controller) {
        for (const frame of frames) {
          controller.enqueue(encoder.encode(frame))
        }
        controller.close()
      },
    })
  }

  test('parses single data frame', async () => {
    const stream = sseStream('data: {"id":1}\n\n')
    const events: unknown[] = []
    for await (const event of parseSSEStream(stream)) {
      events.push(event)
    }
    expect(events).toEqual([{ id: 1 }])
  })

  test('parses multiple frames', async () => {
    const stream = sseStream('data: {"a":1}\n\ndata: {"b":2}\n\n')
    const events: unknown[] = []
    for await (const event of parseSSEStream(stream)) {
      events.push(event)
    }
    expect(events).toEqual([{ a: 1 }, { b: 2 }])
  })

  test('handles chunked delivery across frame boundaries', async () => {
    // Frame split across two chunks
    const stream = sseStream('data: {"spl', 'it":true}\n\n')
    const events: unknown[] = []
    for await (const event of parseSSEStream(stream)) {
      events.push(event)
    }
    expect(events).toEqual([{ split: true }])
  })

  test('ignores event: lines', async () => {
    const stream = sseStream('event: error\ndata: {"err":true}\n\n')
    const events: unknown[] = []
    for await (const event of parseSSEStream(stream)) {
      events.push(event)
    }
    expect(events).toEqual([{ err: true }])
  })

  test('respects abort signal', async () => {
    const controller = new AbortController()
    controller.abort()
    const stream = sseStream('data: {"a":1}\n\ndata: {"b":2}\n\n')
    const events: unknown[] = []
    for await (const event of parseSSEStream(stream, controller.signal)) {
      events.push(event)
    }
    expect(events).toEqual([])
  })

  test('round-trips with formatSSE', async () => {
    const original = { kind: 'task', id: 'task-1', status: { state: 'working' } }
    const sse = formatSSE(original)
    const stream = sseStream(sse)
    const events: unknown[] = []
    for await (const event of parseSSEStream(stream)) {
      events.push(event)
    }
    expect(events).toEqual([original])
  })
})

// ── JSON-RPC Framing ──────────────────────────────────────────────────────────

describe('JSON-RPC Framing', () => {
  test('jsonRpcRequest creates valid envelope', () => {
    const req = jsonRpcRequest('message/send', { data: 'test' }, 1)
    expect(req).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'message/send',
      params: { data: 'test' },
    })
  })

  test('jsonRpcRequest accepts string id', () => {
    const req = jsonRpcRequest('tasks/get', {}, 'req-abc')
    expect(req.id).toBe('req-abc')
  })

  test('jsonRpcSuccess creates valid envelope', () => {
    const res = jsonRpcSuccess({ kind: 'task', id: 'task-1' }, 1)
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { kind: 'task', id: 'task-1' },
    })
  })

  test('jsonRpcError creates valid envelope', () => {
    const res = jsonRpcError(-32601, 'Method not found', 1)
    expect(res).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32601, message: 'Method not found' },
    })
  })

  test('jsonRpcError includes data when provided', () => {
    const res = jsonRpcError(-32602, 'Invalid params', 1, { field: 'message' })
    expect(res.error.data).toEqual({ field: 'message' })
  })

  test('jsonRpcError omits data when undefined', () => {
    const res = jsonRpcError(-32603, 'Internal error', null)
    expect(res.error).not.toHaveProperty('data')
  })
})

// ── Agent Card Signing ────────────────────────────────────────────────────────

describe('Agent Card Signing', () => {
  const generateKeyPair = () =>
    crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])

  const testCard: AgentCard = {
    name: 'Test Agent',
    url: 'https://agent.example.com',
    version: '1.0.0',
  }

  test('signAgentCard produces JWS compact serialization', async () => {
    const keyPair = await generateKeyPair()
    const signed = await signAgentCard(testCard, keyPair.privateKey)

    expect(signed.signature).toBeDefined()
    expect(signed.signature!.algorithm).toBe('ES256')

    // JWS compact format: header.payload.signature
    const parts = signed.signature!.signature.split('.')
    expect(parts).toHaveLength(3)

    // Header should decode to { alg: 'ES256' }
    expect(parts[0]).toBeDefined()
    const header = JSON.parse(atob(parts[0]!.replace(/-/g, '+').replace(/_/g, '/')))
    expect(header).toEqual({ alg: 'ES256' })
  })

  test('signAgentCard strips existing signature from payload', async () => {
    const keyPair = await generateKeyPair()
    const cardWithSig: AgentCard = { ...testCard, signature: { signature: 'old-sig' } }
    const signed = await signAgentCard(cardWithSig, keyPair.privateKey)

    // Decode payload and verify signature field is not included
    const parts = signed.signature!.signature.split('.')
    expect(parts[1]).toBeDefined()
    const padded = `${parts[1]!.replace(/-/g, '+').replace(/_/g, '/')}==`
    const payload = JSON.parse(atob(padded))
    expect(payload).not.toHaveProperty('signature')
    expect(payload.name).toBe('Test Agent')
  })

  test('verifyAgentCardSignature returns true for valid signature', async () => {
    const keyPair = await generateKeyPair()
    const signed = await signAgentCard(testCard, keyPair.privateKey)
    const valid = await verifyAgentCardSignature(signed, keyPair.publicKey)
    expect(valid).toBe(true)
  })

  test('verifyAgentCardSignature returns false for wrong key', async () => {
    const keyPair1 = await generateKeyPair()
    const keyPair2 = await generateKeyPair()
    const signed = await signAgentCard(testCard, keyPair1.privateKey)
    const valid = await verifyAgentCardSignature(signed, keyPair2.publicKey)
    expect(valid).toBe(false)
  })

  test('verifyAgentCardSignature returns false for missing signature', async () => {
    const keyPair = await generateKeyPair()
    const valid = await verifyAgentCardSignature(testCard, keyPair.publicKey)
    expect(valid).toBe(false)
  })

  test('verifyAgentCardSignature returns false for malformed signature', async () => {
    const keyPair = await generateKeyPair()
    const card: AgentCard = { ...testCard, signature: { signature: 'not.valid' } }
    const valid = await verifyAgentCardSignature(card, keyPair.publicKey)
    expect(valid).toBe(false)
  })

  test('sign then verify round-trip with full card', async () => {
    const keyPair = await generateKeyPair()
    const fullCard: AgentCard = {
      name: 'Full Agent',
      description: 'Comprehensive test',
      url: 'https://full.example.com',
      provider: { organization: 'Test Corp' },
      version: '2.0.0',
      capabilities: { streaming: true },
      skills: [{ id: 'test', name: 'Test Skill' }],
    }
    const signed = await signAgentCard(fullCard, keyPair.privateKey)
    const valid = await verifyAgentCardSignature(signed, keyPair.publicKey)
    expect(valid).toBe(true)
  })
})

// ── A2AError ──────────────────────────────────────────────────────────────────

describe('A2AError', () => {
  test('constructs with code and message', () => {
    const error = new A2AError(-32601, 'Method not found')
    expect(error.code).toBe(-32601)
    expect(error.message).toBe('Method not found')
    expect(error.name).toBe('A2AError')
    expect(error).toBeInstanceOf(Error)
  })

  test('includes optional data', () => {
    const error = new A2AError(-32602, 'Invalid', { field: 'id' })
    expect(error.data).toEqual({ field: 'id' })
  })

  test('fromResponse creates from JSON-RPC error', () => {
    const error = A2AError.fromResponse({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32700, message: 'Parse error', data: 'details' },
    })
    expect(error.code).toBe(-32700)
    expect(error.message).toBe('Parse error')
    expect(error.data).toBe('details')
  })

  test('methodNotFound factory', () => {
    const error = A2AError.methodNotFound('tasks/cancel')
    expect(error.code).toBe(A2A_ERROR_CODE.method_not_found)
    expect(error.message).toContain('tasks/cancel')
  })

  test('invalidParams factory', () => {
    const error = A2AError.invalidParams('Missing message field')
    expect(error.code).toBe(A2A_ERROR_CODE.invalid_params)
  })

  test('internalError factory', () => {
    const error = A2AError.internalError('Something broke')
    expect(error.code).toBe(A2A_ERROR_CODE.internal_error)
  })
})

// ── Push Notification Delivery ──────────────────────────────────────────────

describe('sendPushNotification', () => {
  test('posts event to webhook URL', async () => {
    let receivedBody: unknown = null
    let receivedHeaders: Record<string, string> = {}

    const webhookServer = Bun.serve({
      port: 0,
      async fetch(req) {
        receivedHeaders = Object.fromEntries(req.headers.entries())
        receivedBody = await req.json()
        return new Response('OK', { status: 200 })
      },
    })

    try {
      const ok = await sendPushNotification(
        { url: `http://localhost:${webhookServer.port}` },
        { kind: 'status-update', taskId: 'task-1', status: { state: 'completed' }, final: true },
      )
      expect(ok).toBe(true)
      expect(receivedHeaders['content-type']).toBe('application/json')
      expect(receivedBody).toHaveProperty('jsonrpc', '2.0')
      expect(receivedBody).toHaveProperty('result')
      const result = (receivedBody as { result: unknown }).result as Record<string, unknown>
      expect(result.kind).toBe('status-update')
      expect(result.taskId).toBe('task-1')
    } finally {
      webhookServer.stop(true)
    }
  })

  test('sends Bearer token when configured', async () => {
    let receivedAuth = ''

    const webhookServer = Bun.serve({
      port: 0,
      async fetch(req) {
        receivedAuth = req.headers.get('authorization') ?? ''
        return new Response('OK', { status: 200 })
      },
    })

    try {
      await sendPushNotification(
        { url: `http://localhost:${webhookServer.port}`, token: 'my-secret-token' },
        { kind: 'status-update', taskId: 'task-1', status: { state: 'working' }, final: false },
      )
      expect(receivedAuth).toBe('Bearer my-secret-token')
    } finally {
      webhookServer.stop(true)
    }
  })

  test('returns false on non-2xx response', async () => {
    const webhookServer = Bun.serve({
      port: 0,
      fetch() {
        return new Response('Forbidden', { status: 403 })
      },
    })

    try {
      const ok = await sendPushNotification(
        { url: `http://localhost:${webhookServer.port}` },
        { kind: 'status-update', taskId: 'task-1', status: { state: 'failed' }, final: true },
      )
      expect(ok).toBe(false)
    } finally {
      webhookServer.stop(true)
    }
  })
})
