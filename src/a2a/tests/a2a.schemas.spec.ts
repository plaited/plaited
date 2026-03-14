import { describe, expect, test } from 'bun:test'
import {
  AgentCardSchema,
  ArtifactSchema,
  DataPartSchema,
  FilePartSchema,
  JsonRpcErrorResponseSchema,
  JsonRpcRequestSchema,
  JsonRpcSuccessResponseSchema,
  MessageSchema,
  MessageSendParamsSchema,
  PartSchema,
  SecuritySchemeSchema,
  TaskArtifactUpdateEventSchema,
  TaskIdParamsSchema,
  TaskQueryParamsSchema,
  TaskSchema,
  TaskStatusSchema,
  TaskStatusUpdateEventSchema,
  TextPartSchema,
} from '../a2a.schemas.ts'

// ── Part Schemas ──────────────────────────────────────────────────────────────

describe('Part Schemas', () => {
  test('TextPart parses valid text', () => {
    const result = TextPartSchema.parse({
      kind: 'text',
      text: 'Hello, agent!',
    })
    expect(result.kind).toBe('text')
    expect(result.text).toBe('Hello, agent!')
  })

  test('TextPart accepts optional metadata', () => {
    const result = TextPartSchema.parse({
      kind: 'text',
      text: 'hello',
      metadata: { source: 'user' },
    })
    expect(result.metadata).toEqual({ source: 'user' })
  })

  test('TextPart rejects missing text', () => {
    expect(() => TextPartSchema.parse({ kind: 'text' })).toThrow()
  })

  test('FilePart parses file with bytes', () => {
    const result = FilePartSchema.parse({
      kind: 'file',
      file: { bytes: 'aGVsbG8=', mimeType: 'text/plain' },
    })
    expect(result.kind).toBe('file')
    expect(result.file).toHaveProperty('bytes', 'aGVsbG8=')
  })

  test('FilePart parses file with uri', () => {
    const result = FilePartSchema.parse({
      kind: 'file',
      file: { uri: 'https://example.com/file.txt', name: 'file.txt' },
    })
    expect(result.file).toHaveProperty('uri', 'https://example.com/file.txt')
  })

  test('DataPart parses structured data', () => {
    const result = DataPartSchema.parse({
      kind: 'data',
      data: { key: 'value', nested: { a: 1 } },
    })
    expect(result.kind).toBe('data')
    expect(result.data).toEqual({ key: 'value', nested: { a: 1 } })
  })

  test('PartSchema discriminates on kind', () => {
    const text = PartSchema.parse({ kind: 'text', text: 'hi' })
    expect(text.kind).toBe('text')

    const file = PartSchema.parse({ kind: 'file', file: { bytes: 'abc' } })
    expect(file.kind).toBe('file')

    const data = PartSchema.parse({ kind: 'data', data: { x: 1 } })
    expect(data.kind).toBe('data')
  })

  test('PartSchema rejects unknown kind', () => {
    expect(() => PartSchema.parse({ kind: 'unknown', value: 'x' })).toThrow()
  })
})

// ── Message Schema ────────────────────────────────────────────────────────────

describe('Message Schema', () => {
  const validMessage = {
    kind: 'message' as const,
    messageId: 'msg-1',
    role: 'user' as const,
    parts: [{ kind: 'text' as const, text: 'Hello' }],
  }

  test('parses valid message', () => {
    const result = MessageSchema.parse(validMessage)
    expect(result.kind).toBe('message')
    expect(result.messageId).toBe('msg-1')
    expect(result.role).toBe('user')
    expect(result.parts).toHaveLength(1)
  })

  test('accepts optional fields', () => {
    const result = MessageSchema.parse({
      ...validMessage,
      contextId: 'ctx-1',
      taskId: 'task-1',
      referenceTaskIds: ['task-0'],
      extensions: ['ext-1'],
      metadata: { priority: 'high' },
    })
    expect(result.contextId).toBe('ctx-1')
    expect(result.taskId).toBe('task-1')
    expect(result.referenceTaskIds).toEqual(['task-0'])
  })

  test('rejects invalid role', () => {
    expect(() => MessageSchema.parse({ ...validMessage, role: 'system' })).toThrow()
  })

  test('rejects missing parts', () => {
    const { parts: _, ...noParts } = validMessage
    expect(() => MessageSchema.parse(noParts)).toThrow()
  })
})

// ── Task Schemas ──────────────────────────────────────────────────────────────

describe('Task Schemas', () => {
  test('TaskStatus parses with valid state', () => {
    const result = TaskStatusSchema.parse({ state: 'working' })
    expect(result.state).toBe('working')
  })

  test('TaskStatus accepts kebab-case states', () => {
    const result = TaskStatusSchema.parse({ state: 'input-required' })
    expect(result.state).toBe('input-required')

    const result2 = TaskStatusSchema.parse({ state: 'auth-required' })
    expect(result2.state).toBe('auth-required')
  })

  test('TaskStatus rejects invalid state', () => {
    expect(() => TaskStatusSchema.parse({ state: 'running' })).toThrow()
  })

  test('TaskSchema parses valid task', () => {
    const result = TaskSchema.parse({
      kind: 'task',
      id: 'task-1',
      status: { state: 'submitted' },
    })
    expect(result.kind).toBe('task')
    expect(result.id).toBe('task-1')
    expect(result.status.state).toBe('submitted')
  })

  test('TaskSchema accepts artifacts and history', () => {
    const result = TaskSchema.parse({
      kind: 'task',
      id: 'task-2',
      contextId: 'ctx-1',
      status: { state: 'completed' },
      artifacts: [
        {
          artifactId: 'art-1',
          name: 'result',
          parts: [{ kind: 'text', text: 'output' }],
        },
      ],
      history: [
        {
          kind: 'message',
          messageId: 'msg-1',
          role: 'user',
          parts: [{ kind: 'text', text: 'input' }],
        },
      ],
    })
    expect(result.artifacts).toHaveLength(1)
    expect(result.history).toHaveLength(1)
  })

  test('ArtifactSchema parses with parts', () => {
    const result = ArtifactSchema.parse({
      artifactId: 'art-1',
      parts: [{ kind: 'data', data: { code: 'fn()' } }],
    })
    expect(result.artifactId).toBe('art-1')
    expect(result.parts).toHaveLength(1)
  })
})

// ── Stream Event Schemas ──────────────────────────────────────────────────────

describe('Stream Event Schemas', () => {
  test('TaskStatusUpdateEvent parses', () => {
    const result = TaskStatusUpdateEventSchema.parse({
      kind: 'status-update',
      taskId: 'task-1',
      status: { state: 'working' },
      final: false,
    })
    expect(result.kind).toBe('status-update')
    expect(result.final).toBe(false)
  })

  test('TaskArtifactUpdateEvent parses', () => {
    const result = TaskArtifactUpdateEventSchema.parse({
      kind: 'artifact-update',
      taskId: 'task-1',
      artifact: {
        artifactId: 'art-1',
        parts: [{ kind: 'text', text: 'partial output' }],
      },
    })
    expect(result.kind).toBe('artifact-update')
    expect(result.artifact.artifactId).toBe('art-1')
  })
})

// ── Security Scheme Schemas ───────────────────────────────────────────────────

describe('Security Scheme Schemas', () => {
  test('apiKey scheme parses', () => {
    const result = SecuritySchemeSchema.parse({
      type: 'apiKey',
      name: 'X-API-Key',
      in: 'header',
    })
    expect(result.type).toBe('apiKey')
  })

  test('http bearer scheme parses', () => {
    const result = SecuritySchemeSchema.parse({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
    expect(result.type).toBe('http')
  })

  test('oauth2 scheme parses', () => {
    const result = SecuritySchemeSchema.parse({
      type: 'oauth2',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
        },
      },
    })
    expect(result.type).toBe('oauth2')
  })

  test('mutualTLS scheme parses', () => {
    const result = SecuritySchemeSchema.parse({
      type: 'mutualTLS',
      description: 'Client certificate required',
    })
    expect(result.type).toBe('mutualTLS')
  })

  test('rejects unknown security type', () => {
    expect(() => SecuritySchemeSchema.parse({ type: 'custom', data: {} })).toThrow()
  })
})

// ── Agent Card Schema ─────────────────────────────────────────────────────────

describe('Agent Card Schema', () => {
  test('parses minimal card', () => {
    const result = AgentCardSchema.parse({
      name: 'Test Agent',
      url: 'https://agent.example.com',
    })
    expect(result.name).toBe('Test Agent')
    expect(result.url).toBe('https://agent.example.com')
  })

  test('parses full card', () => {
    const result = AgentCardSchema.parse({
      name: 'Full Agent',
      description: 'A fully configured agent',
      url: 'https://agent.example.com',
      provider: { organization: 'Acme Corp', url: 'https://acme.com' },
      version: '1.0.0',
      protocolVersion: '0.2.0',
      capabilities: { streaming: true, pushNotifications: false },
      skills: [{ id: 'code-review', name: 'Code Review', description: 'Reviews code' }],
      preferredTransport: 'http+sse',
      supportsAuthenticatedExtendedCard: true,
    })
    expect(result.capabilities?.streaming).toBe(true)
    expect(result.skills).toHaveLength(1)
  })

  test('rejects missing required fields', () => {
    expect(() => AgentCardSchema.parse({ description: 'no name or url' })).toThrow()
  })
})

// ── Request Parameter Schemas ─────────────────────────────────────────────────

describe('Request Parameter Schemas', () => {
  test('MessageSendParams parses', () => {
    const result = MessageSendParamsSchema.parse({
      message: {
        kind: 'message',
        messageId: 'msg-1',
        role: 'user',
        parts: [{ kind: 'text', text: 'Hello' }],
      },
    })
    expect(result.message.messageId).toBe('msg-1')
  })

  test('MessageSendParams accepts configuration', () => {
    const result = MessageSendParamsSchema.parse({
      message: {
        kind: 'message',
        messageId: 'msg-1',
        role: 'user',
        parts: [{ kind: 'text', text: 'Hello' }],
      },
      configuration: {
        acceptedOutputModes: ['text'],
        historyLength: 10,
        blocking: true,
      },
    })
    expect(result.configuration?.blocking).toBe(true)
  })

  test('TaskQueryParams parses', () => {
    const result = TaskQueryParamsSchema.parse({ id: 'task-1', historyLength: 5 })
    expect(result.id).toBe('task-1')
    expect(result.historyLength).toBe(5)
  })

  test('TaskIdParams parses', () => {
    const result = TaskIdParamsSchema.parse({ id: 'task-1' })
    expect(result.id).toBe('task-1')
  })
})

// ── JSON-RPC Envelope Schemas ─────────────────────────────────────────────────

describe('JSON-RPC Schemas', () => {
  test('JsonRpcRequest parses with string id', () => {
    const result = JsonRpcRequestSchema.parse({
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'message/send',
      params: {},
    })
    expect(result.jsonrpc).toBe('2.0')
    expect(result.id).toBe('req-1')
    expect(result.method).toBe('message/send')
  })

  test('JsonRpcRequest parses with numeric id', () => {
    const result = JsonRpcRequestSchema.parse({
      jsonrpc: '2.0',
      id: 42,
      method: 'tasks/get',
    })
    expect(result.id).toBe(42)
  })

  test('JsonRpcRequest rejects invalid method', () => {
    expect(() =>
      JsonRpcRequestSchema.parse({
        jsonrpc: '2.0',
        id: 1,
        method: 'invalid/method',
      }),
    ).toThrow()
  })

  test('JsonRpcSuccessResponse parses', () => {
    const result = JsonRpcSuccessResponseSchema.parse({
      jsonrpc: '2.0',
      id: 1,
      result: { kind: 'task', id: 'task-1', status: { state: 'submitted' } },
    })
    expect(result.result).toBeDefined()
  })

  test('JsonRpcErrorResponse parses', () => {
    const result = JsonRpcErrorResponseSchema.parse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    })
    expect(result.error.code).toBe(-32700)
    expect(result.error.message).toBe('Parse error')
  })

  test('JsonRpcErrorResponse accepts error data', () => {
    const result = JsonRpcErrorResponseSchema.parse({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32602, message: 'Invalid params', data: { field: 'message' } },
    })
    expect(result.error.data).toEqual({ field: 'message' })
  })
})
