import { describe, expect, mock, test } from 'bun:test'
import type { A2ATask, AgentCard, JsonRpcSuccessResponse } from '../a2a.types.ts'
import { A2AError, createA2AClient, createTextMessage, extractText } from '../a2a-client.ts'

describe('createA2AClient', () => {
  test('normalizes URL with trailing slash', () => {
    const client = createA2AClient({ agentUrl: 'https://agent.example.com/' })
    expect(client.url).toBe('https://agent.example.com')
  })

  test('preserves URL without trailing slash', () => {
    const client = createA2AClient({ agentUrl: 'https://agent.example.com' })
    expect(client.url).toBe('https://agent.example.com')
  })
})

describe('extractText', () => {
  test('extracts text from text parts', () => {
    const parts = [
      { type: 'text' as const, text: 'Hello' },
      { type: 'text' as const, text: 'World' },
    ]
    expect(extractText(parts)).toBe('Hello\nWorld')
  })

  test('ignores non-text parts', () => {
    const parts = [
      { type: 'text' as const, text: 'Hello' },
      { type: 'data' as const, data: { foo: 'bar' } },
      { type: 'text' as const, text: 'World' },
    ]
    expect(extractText(parts)).toBe('Hello\nWorld')
  })

  test('returns empty string for no text parts', () => {
    const parts = [{ type: 'data' as const, data: { foo: 'bar' } }]
    expect(extractText(parts)).toBe('')
  })
})

describe('createTextMessage', () => {
  test('creates user message by default', () => {
    const message = createTextMessage('Hello')
    expect(message.role).toBe('user')
    expect(message.parts).toHaveLength(1)
    expect(message.parts[0]).toEqual({ type: 'text', text: 'Hello' })
  })

  test('creates agent message when specified', () => {
    const message = createTextMessage('Response', 'agent')
    expect(message.role).toBe('agent')
  })
})

describe('A2AError', () => {
  test('creates error with code and message', () => {
    const error = new A2AError(-32001, 'Task not found')
    expect(error.code).toBe(-32001)
    expect(error.message).toBe('Task not found')
    expect(error.name).toBe('A2AError')
  })

  test('includes optional data', () => {
    const error = new A2AError(-32001, 'Task not found', { taskId: '123' })
    expect(error.data).toEqual({ taskId: '123' })
  })
})

describe('A2A Client integration', () => {
  // Mock fetch for testing
  const mockFetch = (response: unknown, ok = true) => {
    return mock(() =>
      Promise.resolve({
        ok,
        status: ok ? 200 : 500,
        statusText: ok ? 'OK' : 'Internal Server Error',
        json: () => Promise.resolve(response),
      }),
    )
  }

  test('getAgentCard fetches from well-known endpoint', async () => {
    const card: AgentCard = {
      name: 'Test Agent',
      description: 'A test agent',
      url: 'https://agent.example.com',
      version: '1.0',
      skills: [],
    }

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch(card) as unknown as typeof fetch

    try {
      const client = createA2AClient({ agentUrl: 'https://agent.example.com' })
      const result = await client.getAgentCard()

      expect(result.name).toBe('Test Agent')
      expect(result.description).toBe('A test agent')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('sendTask sends JSON-RPC request', async () => {
    const task: A2ATask = {
      id: 'task-1',
      state: 'working',
      messages: [],
      artifacts: [],
    }

    const response: JsonRpcSuccessResponse = {
      jsonrpc: '2.0',
      id: 'test-id',
      result: task,
    }

    const originalFetch = globalThis.fetch
    const mockFn = mockFetch(response)
    globalThis.fetch = mockFn as unknown as typeof fetch

    try {
      const client = createA2AClient({ agentUrl: 'https://agent.example.com' })
      const result = await client.sendTask({
        id: 'task-1',
        message: createTextMessage('Test'),
      })

      expect(result.id).toBe('task-1')
      expect(result.state).toBe('working')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('handles JSON-RPC error response', async () => {
    const response = {
      jsonrpc: '2.0',
      id: 'test-id',
      error: {
        code: -32001,
        message: 'Task not found',
      },
    }

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch(response) as unknown as typeof fetch

    try {
      const client = createA2AClient({ agentUrl: 'https://agent.example.com' })

      await expect(client.getTask({ id: 'nonexistent' })).rejects.toThrow('Task not found')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
