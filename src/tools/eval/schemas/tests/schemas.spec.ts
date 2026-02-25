import { describe, expect, test } from 'bun:test'
import {
  CaptureResultSchema,
  EnvVariableSchema,
  GraderResultSchema,
  HttpHeaderSchema,
  JsonRpcErrorResponseSchema,
  JsonRpcErrorSchema,
  JsonRpcMessageSchema,
  JsonRpcNotificationSchema,
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  JsonRpcSuccessResponseSchema,
  McpServerHttpSchema,
  McpServerSchema,
  McpServerStdioSchema,
  MessageStepSchema,
  PlanStepSchema,
  PromptCaseSchema,
  SessionSchema,
  ThoughtStepSchema,
  TimingSchema,
  ToolCallStepSchema,
  ToolInputSchema,
  TrajectoryRichnessSchema,
  TrajectoryStepSchema,
} from '../schemas.ts'

// ============================================================================
// Session Schema
// ============================================================================

describe('SessionSchema', () => {
  test('parses valid session', () => {
    const result = SessionSchema.safeParse({ id: 'sess_123' })
    expect(result.success).toBe(true)
  })

  test('parses session with _meta', () => {
    const result = SessionSchema.safeParse({ id: 'sess_123', _meta: { key: 'value' } })
    expect(result.success).toBe(true)
  })

  test('rejects session without id', () => {
    const result = SessionSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// JSON-RPC Schemas
// ============================================================================

describe('JsonRpcRequestSchema', () => {
  test('parses valid request', () => {
    const result = JsonRpcRequestSchema.safeParse({
      jsonrpc: '2.0',
      id: 1,
      method: 'test',
    })
    expect(result.success).toBe(true)
  })

  test('parses request with params', () => {
    const result = JsonRpcRequestSchema.safeParse({
      jsonrpc: '2.0',
      id: 'abc',
      method: 'test',
      params: { foo: 'bar' },
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid jsonrpc version', () => {
    const result = JsonRpcRequestSchema.safeParse({
      jsonrpc: '1.0',
      id: 1,
      method: 'test',
    })
    expect(result.success).toBe(false)
  })
})

describe('JsonRpcNotificationSchema', () => {
  test('parses notification without id', () => {
    const result = JsonRpcNotificationSchema.safeParse({
      jsonrpc: '2.0',
      method: 'notify',
    })
    expect(result.success).toBe(true)
  })
})

describe('JsonRpcErrorSchema', () => {
  test('parses error with code and message', () => {
    const result = JsonRpcErrorSchema.safeParse({
      code: -32600,
      message: 'Invalid request',
    })
    expect(result.success).toBe(true)
  })

  test('parses error with data', () => {
    const result = JsonRpcErrorSchema.safeParse({
      code: -32603,
      message: 'Internal error',
      data: { details: 'something went wrong' },
    })
    expect(result.success).toBe(true)
  })
})

describe('JsonRpcSuccessResponseSchema', () => {
  test('parses success response', () => {
    const result = JsonRpcSuccessResponseSchema.safeParse({
      jsonrpc: '2.0',
      id: 1,
      result: { data: 'test' },
    })
    expect(result.success).toBe(true)
  })
})

describe('JsonRpcErrorResponseSchema', () => {
  test('parses error response with id', () => {
    const result = JsonRpcErrorResponseSchema.safeParse({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32600, message: 'Invalid' },
    })
    expect(result.success).toBe(true)
  })

  test('parses error response with null id', () => {
    const result = JsonRpcErrorResponseSchema.safeParse({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    })
    expect(result.success).toBe(true)
  })
})

describe('JsonRpcResponseSchema', () => {
  test('parses success response', () => {
    const result = JsonRpcResponseSchema.safeParse({
      jsonrpc: '2.0',
      id: 1,
      result: 'ok',
    })
    expect(result.success).toBe(true)
  })

  test('parses error response', () => {
    const result = JsonRpcResponseSchema.safeParse({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32600, message: 'Invalid' },
    })
    expect(result.success).toBe(true)
  })
})

describe('JsonRpcMessageSchema', () => {
  test('parses request', () => {
    const result = JsonRpcMessageSchema.safeParse({
      jsonrpc: '2.0',
      id: 1,
      method: 'test',
    })
    expect(result.success).toBe(true)
  })

  test('parses notification', () => {
    const result = JsonRpcMessageSchema.safeParse({
      jsonrpc: '2.0',
      method: 'notify',
    })
    expect(result.success).toBe(true)
  })

  test('parses response', () => {
    const result = JsonRpcMessageSchema.safeParse({
      jsonrpc: '2.0',
      id: 1,
      result: 'ok',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// MCP Server Schemas
// ============================================================================

describe('EnvVariableSchema', () => {
  test('parses valid env variable', () => {
    const result = EnvVariableSchema.safeParse({ name: 'API_KEY', value: 'secret' })
    expect(result.success).toBe(true)
  })
})

describe('HttpHeaderSchema', () => {
  test('parses valid header', () => {
    const result = HttpHeaderSchema.safeParse({ name: 'Authorization', value: 'Bearer token' })
    expect(result.success).toBe(true)
  })
})

describe('McpServerStdioSchema', () => {
  test('parses stdio config with optional type', () => {
    const result = McpServerStdioSchema.safeParse({
      name: 'test-server',
      command: 'node',
      args: ['server.js'],
      env: [],
    })
    expect(result.success).toBe(true)
  })

  test('parses stdio config with explicit type', () => {
    const result = McpServerStdioSchema.safeParse({
      type: 'stdio',
      name: 'test-server',
      command: 'bun',
      args: ['run', 'server.ts'],
      env: [{ name: 'DEBUG', value: 'true' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('McpServerHttpSchema', () => {
  test('parses http config', () => {
    const result = McpServerHttpSchema.safeParse({
      type: 'http',
      name: 'api-server',
      url: 'https://api.example.com',
      headers: [{ name: 'Authorization', value: 'Bearer token' }],
    })
    expect(result.success).toBe(true)
  })
})

describe('McpServerSchema', () => {
  test('parses stdio server', () => {
    const result = McpServerSchema.safeParse({
      name: 'test',
      command: 'node',
      args: [],
      env: [],
    })
    expect(result.success).toBe(true)
  })

  test('parses http server', () => {
    const result = McpServerSchema.safeParse({
      type: 'http',
      name: 'test',
      url: 'https://example.com',
      headers: [],
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// Prompt Case Schema
// ============================================================================

describe('PromptCaseSchema', () => {
  test('parses minimal prompt case', () => {
    const result = PromptCaseSchema.safeParse({
      id: 'test-1',
      input: 'Hello',
    })
    expect(result.success).toBe(true)
  })

  test('parses single-turn with hint', () => {
    const result = PromptCaseSchema.safeParse({
      id: 'test-1',
      input: 'What is 2+2?',
      hint: '4',
    })
    expect(result.success).toBe(true)
  })

  test('parses multi-turn input array', () => {
    const result = PromptCaseSchema.safeParse({
      id: 'test-1',
      input: ['Hello', 'How are you?', 'Goodbye'],
    })
    expect(result.success).toBe(true)
  })

  test('parses full prompt case with all fields', () => {
    const result = PromptCaseSchema.safeParse({
      id: 'test-1',
      input: ['Hello'],
      hint: 'greeting',
      reference: 'Hi there!',
      metadata: { category: 'test', difficulty: 'easy' },
      timeout: 30000,
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing id', () => {
    const result = PromptCaseSchema.safeParse({ input: 'Hello' })
    expect(result.success).toBe(false)
  })

  test('rejects missing input', () => {
    const result = PromptCaseSchema.safeParse({ id: 'test-1' })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// Grader Result Schema
// ============================================================================

describe('GraderResultSchema', () => {
  test('parses valid grader result', () => {
    const result = GraderResultSchema.safeParse({
      pass: true,
      score: 1.0,
    })
    expect(result.success).toBe(true)
  })

  test('parses result with reasoning', () => {
    const result = GraderResultSchema.safeParse({
      pass: false,
      score: 0.5,
      reasoning: 'Partial match',
    })
    expect(result.success).toBe(true)
  })

  test('rejects score below 0', () => {
    const result = GraderResultSchema.safeParse({
      pass: false,
      score: -0.1,
    })
    expect(result.success).toBe(false)
  })

  test('rejects score above 1', () => {
    const result = GraderResultSchema.safeParse({
      pass: true,
      score: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// Trajectory Step Schemas
// ============================================================================

describe('ToolInputSchema', () => {
  test('parses file path input', () => {
    const result = ToolInputSchema.safeParse({ file_path: '/src/index.ts' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.file_path).toBe('/src/index.ts')
    }
  })

  test('allows additional properties via passthrough', () => {
    const result = ToolInputSchema.safeParse({
      file_path: '/test.ts',
      custom_field: 'value',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.custom_field).toBe('value')
    }
  })
})

describe('ThoughtStepSchema', () => {
  test('parses thought step', () => {
    const result = ThoughtStepSchema.safeParse({
      type: 'thought',
      content: 'Thinking about the problem...',
      timestamp: 1234567890,
    })
    expect(result.success).toBe(true)
  })
})

describe('MessageStepSchema', () => {
  test('parses message step', () => {
    const result = MessageStepSchema.safeParse({
      type: 'message',
      content: 'Hello, world!',
      timestamp: 1234567890,
    })
    expect(result.success).toBe(true)
  })
})

describe('ToolCallStepSchema', () => {
  test('parses tool call step', () => {
    const result = ToolCallStepSchema.safeParse({
      type: 'tool_call',
      name: 'Read',
      status: 'completed',
      timestamp: 1234567890,
    })
    expect(result.success).toBe(true)
  })

  test('parses tool call with input/output', () => {
    const result = ToolCallStepSchema.safeParse({
      type: 'tool_call',
      name: 'Write',
      status: 'completed',
      input: { file_path: '/test.ts', content: 'code' },
      output: 'File written',
      duration: 150,
      timestamp: 1234567890,
    })
    expect(result.success).toBe(true)
  })
})

describe('PlanStepSchema', () => {
  test('parses plan step', () => {
    const result = PlanStepSchema.safeParse({
      type: 'plan',
      entries: [{ task: 'Step 1' }, { task: 'Step 2' }],
      timestamp: 1234567890,
    })
    expect(result.success).toBe(true)
  })
})

describe('TrajectoryStepSchema', () => {
  test('discriminates thought type', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'thought',
      content: 'test',
      timestamp: 123,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('thought')
    }
  })

  test('discriminates message type', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'message',
      content: 'test',
      timestamp: 123,
    })
    expect(result.success).toBe(true)
  })

  test('discriminates tool_call type', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'tool_call',
      name: 'Test',
      status: 'completed',
      timestamp: 123,
    })
    expect(result.success).toBe(true)
  })

  test('discriminates plan type', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'plan',
      entries: [],
      timestamp: 123,
    })
    expect(result.success).toBe(true)
  })

  test('rejects unknown type', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'unknown',
      timestamp: 123,
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// Trajectory Richness Schema
// ============================================================================

describe('TrajectoryRichnessSchema', () => {
  test('parses full', () => {
    expect(TrajectoryRichnessSchema.safeParse('full').success).toBe(true)
  })

  test('parses minimal', () => {
    expect(TrajectoryRichnessSchema.safeParse('minimal').success).toBe(true)
  })

  test('parses messages-only', () => {
    expect(TrajectoryRichnessSchema.safeParse('messages-only').success).toBe(true)
  })

  test('rejects invalid value', () => {
    expect(TrajectoryRichnessSchema.safeParse('invalid').success).toBe(false)
  })
})

// ============================================================================
// Timing Schema
// ============================================================================

describe('TimingSchema', () => {
  test('parses timing with required fields', () => {
    const result = TimingSchema.safeParse({
      start: 1000,
      end: 2000,
      sessionCreation: 100,
      total: 1000,
    })
    expect(result.success).toBe(true)
  })

  test('parses timing with optional fields', () => {
    const result = TimingSchema.safeParse({
      start: 1000,
      end: 2000,
      firstResponse: 500,
      sessionCreation: 100,
      total: 1000,
      inputTokens: 50,
      outputTokens: 100,
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// Capture Result Schema
// ============================================================================

describe('CaptureResultSchema', () => {
  test('parses minimal capture result', () => {
    const result = CaptureResultSchema.safeParse({
      id: 'test-1',
      input: 'Hello',
      output: 'Hi there!',
      trajectory: [],
      metadata: {},
      timing: {
        start: 1000,
        end: 2000,
        sessionCreation: 100,
        total: 1000,
      },
      toolErrors: false,
    })
    expect(result.success).toBe(true)
  })

  test('parses capture result with multi-turn input', () => {
    const result = CaptureResultSchema.safeParse({
      id: 'test-1',
      input: ['Hello', 'Goodbye'],
      output: 'Bye!',
      trajectory: [
        { type: 'message', content: 'Hi', timestamp: 100 },
        { type: 'message', content: 'Bye!', timestamp: 200 },
      ],
      metadata: { agent: 'test-agent', turnCount: 2 },
      timing: {
        start: 1000,
        end: 2000,
        sessionCreation: 100,
        total: 1000,
      },
      toolErrors: false,
    })
    expect(result.success).toBe(true)
  })

  test('parses capture result with hint and score', () => {
    const result = CaptureResultSchema.safeParse({
      id: 'test-1',
      input: 'What is 2+2?',
      output: '4',
      hint: '4',
      trajectory: [],
      metadata: {},
      timing: {
        start: 1000,
        end: 2000,
        sessionCreation: 100,
        total: 1000,
      },
      toolErrors: false,
      score: { pass: true, score: 1.0 },
    })
    expect(result.success).toBe(true)
  })
})
