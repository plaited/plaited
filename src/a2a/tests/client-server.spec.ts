import { afterAll, describe, expect, test } from 'bun:test'
import { createA2AClient } from '../create-a2a-client.ts'
import { AGENT_CARD_PATH } from '../a2a.constants.ts'
import type { AgentCard, Message, Task, TaskPushNotificationConfig } from '../a2a.schemas.ts'
import { createA2AHandler } from '../create-a2a-handler.ts'
import type { A2AOperationHandlers, StreamEvent } from '../a2a.types.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const testCard: AgentCard = {
  name: 'Test Agent',
  url: 'http://localhost',
  version: '1.0.0',
  capabilities: { streaming: true },
}

const makeTask = (id: string, state: string = 'submitted'): Task =>
  ({
    kind: 'task',
    id,
    status: { state },
  }) as Task

const makeMessage = (id: string, text: string): Message => ({
  kind: 'message',
  messageId: id,
  role: 'agent',
  parts: [{ kind: 'text', text }],
})

/** Create a test server with the given handlers */
const createTestServer = (
  handlers: A2AOperationHandlers,
  authenticate?: (req: Request) => Promise<string | undefined>,
) => {
  const { routes } = createA2AHandler({ card: testCard, handlers, authenticate })
  const server = Bun.serve({ port: 0, routes })
  const url = `http://localhost:${server.port}`
  return { server, url }
}

// ── Basic Operations ──────────────────────────────────────────────────────────

describe('Client-Server Integration', () => {
  const handlers: A2AOperationHandlers = {
    sendMessage: async (params) => {
      const text = params.message.parts
        .filter((p): p is { kind: 'text'; text: string; metadata?: Record<string, unknown> } => p.kind === 'text')
        .map((p) => p.text)
        .join('')
      return makeTask(`task-for-${text}`)
    },

    async *sendStreamingMessage(_params, _signal) {
      yield { kind: 'status-update', taskId: 'stream-1', status: { state: 'working' }, final: false } as StreamEvent
      yield makeMessage('msg-stream-1', 'Processing...')
      yield { kind: 'status-update', taskId: 'stream-1', status: { state: 'completed' }, final: true } as StreamEvent
    },

    getTask: async (params) => makeTask(params.id, 'completed'),

    cancelTask: async (params) => makeTask(params.id, 'canceled'),
  }

  let server: ReturnType<typeof Bun.serve>
  let url: string

  test('setup', () => {
    const result = createTestServer(handlers)
    server = result.server
    url = result.url
  })

  afterAll(() => server?.stop(true))

  test('Agent Card served at well-known URL', async () => {
    const response = await fetch(`${url}${AGENT_CARD_PATH}`)
    expect(response.status).toBe(200)
    const card = await response.json()
    expect(card.name).toBe('Test Agent')
    expect(card.capabilities.streaming).toBe(true)
  })

  test('sendMessage round-trip', async () => {
    const client = createA2AClient({ url })
    const result = await client.sendMessage({
      message: {
        kind: 'message',
        messageId: 'msg-1',
        role: 'user',
        parts: [{ kind: 'text', text: 'hello' }],
      },
    })
    expect(result.kind).toBe('task')
    expect((result as Task).id).toBe('task-for-hello')
    client.disconnect()
  })

  test('getTask round-trip', async () => {
    const client = createA2AClient({ url })
    const result = await client.getTask({ id: 'task-42' })
    expect(result.kind).toBe('task')
    expect(result.id).toBe('task-42')
    expect(result.status.state).toBe('completed')
    client.disconnect()
  })

  test('cancelTask round-trip', async () => {
    const client = createA2AClient({ url })
    const result = await client.cancelTask({ id: 'task-99' })
    expect(result.kind).toBe('task')
    expect(result.status.state).toBe('canceled')
    client.disconnect()
  })

  test('sendStreamingMessage consumes SSE events', async () => {
    const client = createA2AClient({ url })
    const events: StreamEvent[] = []
    for await (const event of client.sendStreamingMessage({
      message: {
        kind: 'message',
        messageId: 'msg-stream',
        role: 'user',
        parts: [{ kind: 'text', text: 'stream me' }],
      },
    })) {
      events.push(event)
    }
    expect(events).toHaveLength(3)
    expect(events[0]).toHaveProperty('kind', 'status-update')
    expect(events[1]).toHaveProperty('kind', 'message')
    expect(events[2]).toHaveProperty('kind', 'status-update')
    // @ts-expect-error - accessing final on status-update event
    expect(events[2].final).toBe(true)
    client.disconnect()
  })

  test('fetchAgentCard via client', async () => {
    const client = createA2AClient({ url })
    const card = await client.fetchAgentCard()
    expect(card.name).toBe('Test Agent')
    expect(card.url).toBe('http://localhost')
    client.disconnect()
  })
})

// ── Dynamic Agent Card ────────────────────────────────────────────────────────

describe('Dynamic Agent Card', () => {
  let server: ReturnType<typeof Bun.serve>
  let url: string
  let skillCount: number

  test('setup', () => {
    skillCount = 0
    const { routes } = createA2AHandler({
      card: () => ({
        ...testCard,
        skills: Array.from({ length: skillCount }, (_, i) => ({
          id: `skill-${i}`,
          name: `Skill ${i}`,
        })),
      }),
      handlers: { sendMessage: async () => makeTask('task-1') },
    })
    server = Bun.serve({ port: 0, routes })
    url = `http://localhost:${server.port}`
  })

  afterAll(() => server?.stop(true))

  test('card reflects runtime state changes', async () => {
    const client = createA2AClient({ url })

    // Initially no skills
    const card1 = await client.fetchAgentCard()
    expect(card1.skills).toHaveLength(0)

    // "Add" a skill at runtime
    skillCount = 2
    const card2 = await client.fetchAgentCard()
    expect(card2.skills).toHaveLength(2)

    client.disconnect()
  })
})

// ── Error Handling ────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  const minimalHandlers: A2AOperationHandlers = {
    sendMessage: async () => makeTask('task-1'),
  }

  let server: ReturnType<typeof Bun.serve>
  let url: string

  test('setup', () => {
    const result = createTestServer(minimalHandlers)
    server = result.server
    url = result.url
  })

  afterAll(() => server?.stop(true))

  test('unimplemented method returns method_not_found', async () => {
    const client = createA2AClient({ url })
    try {
      await client.getTask({ id: 'task-1' })
      expect(true).toBe(false) // Should not reach
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { code: number }).code).toBe(-32601)
    }
    client.disconnect()
  })

  test('streaming on non-streaming server returns unsupported', async () => {
    const client = createA2AClient({ url })
    try {
      for await (const _ of client.sendStreamingMessage({
        message: {
          kind: 'message',
          messageId: 'msg-1',
          role: 'user',
          parts: [{ kind: 'text', text: 'test' }],
        },
      })) {
        // Should error before yielding
      }
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { code: number }).code).toBe(-32004)
    }
    client.disconnect()
  })

  test('invalid JSON returns parse error', async () => {
    const response = await fetch(`${url}/a2a`, {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await response.json()
    expect(json.error.code).toBe(-32700)
  })

  test('invalid JSON-RPC request returns invalid request', async () => {
    const response = await fetch(`${url}/a2a`, {
      method: 'POST',
      body: JSON.stringify({ not: 'valid rpc' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await response.json()
    expect(json.error.code).toBe(-32600)
  })

  test('push notification methods return push_notification_not_supported when no handler', async () => {
    const response = await fetch(`${url}/a2a`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/pushNotificationConfig/set',
        params: {},
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await response.json()
    expect(json.error.code).toBe(-32003)
    expect(json.error.message).toBe('Push notifications not supported')
  })

  test('GET on /a2a returns 405', async () => {
    const response = await fetch(`${url}/a2a`)
    expect(response.status).toBe(405)
  })
})

// ── Authentication ────────────────────────────────────────────────────────────

describe('Authentication', () => {
  let server: ReturnType<typeof Bun.serve>
  let url: string

  test('setup', () => {
    const result = createTestServer({ sendMessage: async () => makeTask('task-auth') }, async (req) => {
      const auth = req.headers.get('authorization')
      if (auth !== 'Bearer valid-token') throw new Error('Unauthorized')
      return 'user-1'
    })
    server = result.server
    url = result.url
  })

  afterAll(() => server?.stop(true))

  test('authenticated request succeeds', async () => {
    const client = createA2AClient({
      url,
      headers: { Authorization: 'Bearer valid-token' },
    })
    const result = await client.sendMessage({
      message: {
        kind: 'message',
        messageId: 'msg-1',
        role: 'user',
        parts: [{ kind: 'text', text: 'auth test' }],
      },
    })
    expect((result as Task).id).toBe('task-auth')
    client.disconnect()
  })

  test('unauthenticated request returns 401', async () => {
    const response = await fetch(`${url}/a2a`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'message/send',
        params: {
          message: {
            kind: 'message',
            messageId: 'msg-1',
            role: 'user',
            parts: [{ kind: 'text', text: 'no auth' }],
          },
        },
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    expect(response.status).toBe(401)
  })
})

// ── Handler Errors ────────────────────────────────────────────────────────────

describe('Handler Errors', () => {
  let server: ReturnType<typeof Bun.serve>
  let url: string

  test('setup', () => {
    const result = createTestServer({
      sendMessage: async () => {
        throw new Error('Handler exploded')
      },
    })
    server = result.server
    url = result.url
  })

  afterAll(() => server?.stop(true))

  test('handler exception returns internal error', async () => {
    const client = createA2AClient({ url })
    try {
      await client.sendMessage({
        message: {
          kind: 'message',
          messageId: 'msg-1',
          role: 'user',
          parts: [{ kind: 'text', text: 'boom' }],
        },
      })
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { code: number }).code).toBe(-32603)
      expect((error as Error).message).toBe('Handler exploded')
    }
    client.disconnect()
  })
})

// ── Push Notification CRUD ──────────────────────────────────────────────────

describe('Push Notification Config (HTTP)', () => {
  const configs = new Map<string, TaskPushNotificationConfig>()

  const pushHandlers: A2AOperationHandlers = {
    sendMessage: async () => makeTask('task-1'),
    setPushConfig: async (params) => {
      configs.set(params.id, params)
      return params
    },
    getPushConfig: async (params) => {
      const config = configs.get(params.id)
      if (!config) throw new Error('Config not found')
      return config
    },
    listPushConfigs: async () => [...configs.values()],
    deletePushConfig: async (params) => {
      configs.delete(params.id)
    },
  }

  let server: ReturnType<typeof Bun.serve>
  let url: string

  test('setup', () => {
    configs.clear()
    const result = createTestServer(pushHandlers)
    server = result.server
    url = result.url
  })

  afterAll(() => server?.stop(true))

  test('setPushConfig round-trip', async () => {
    const client = createA2AClient({ url })
    const result = await client.setPushConfig({
      id: 'task-42',
      pushNotificationConfig: {
        url: 'https://example.com/webhook',
        token: 'secret',
      },
    })
    expect(result.id).toBe('task-42')
    expect(result.pushNotificationConfig.url).toBe('https://example.com/webhook')
    expect(result.pushNotificationConfig.token).toBe('secret')
    client.disconnect()
  })

  test('getPushConfig round-trip', async () => {
    const client = createA2AClient({ url })
    const result = await client.getPushConfig({ id: 'task-42' })
    expect(result.id).toBe('task-42')
    expect(result.pushNotificationConfig.url).toBe('https://example.com/webhook')
    client.disconnect()
  })

  test('listPushConfigs round-trip', async () => {
    const client = createA2AClient({ url })
    await client.setPushConfig({
      id: 'task-99',
      pushNotificationConfig: { url: 'https://other.com/hook' },
    })
    const result = await client.listPushConfigs({ id: 'task-42' })
    expect(result).toHaveLength(2)
    client.disconnect()
  })

  test('deletePushConfig round-trip', async () => {
    const client = createA2AClient({ url })
    await client.deletePushConfig({ id: 'task-42' })
    try {
      await client.getPushConfig({ id: 'task-42' })
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
    }
    client.disconnect()
  })
})
