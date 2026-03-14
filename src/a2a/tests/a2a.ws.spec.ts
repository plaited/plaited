import { afterAll, describe, expect, test } from 'bun:test'
import type { Message, Task } from '../a2a.schemas.ts'
import type { A2AOperationHandlers, StreamEvent } from '../a2a.types.ts'
import { createA2AWebSocketClient } from '../a2a.ws-client.ts'
import { createA2AWebSocketHandler } from '../a2a.ws-server.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const msgParams = (text: string) => ({
  message: {
    kind: 'message' as const,
    messageId: `msg-${Date.now()}`,
    role: 'user' as const,
    parts: [{ kind: 'text' as const, text }],
  },
})

/** Wait for WebSocket to connect */
const waitForOpen = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = (e) => reject(e)
  })

// ── Basic Operations ──────────────────────────────────────────────────────────

describe('WebSocket A2A', () => {
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
      yield {
        kind: 'status-update',
        taskId: 'stream-1',
        status: { state: 'completed' },
        final: true,
      } as StreamEvent
    },

    getTask: async (params) => makeTask(params.id, 'completed'),

    cancelTask: async (params) => makeTask(params.id, 'canceled'),
  }

  let server: ReturnType<typeof Bun.serve>
  let wsUrl: string

  test('setup server', () => {
    const { websocket, handleUpgrade } = createA2AWebSocketHandler({ handlers })
    server = Bun.serve({
      port: 0,
      async fetch(req, srv) {
        if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
          return handleUpgrade(req, srv.upgrade.bind(srv))
        }
        return new Response('Not Found', { status: 404 })
      },
      websocket,
    })
    wsUrl = `ws://localhost:${server.port}`
  })

  afterAll(() => server?.stop(true))

  test('sendMessage round-trip', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      const result = await client.sendMessage(msgParams('hello'))
      expect(result.kind).toBe('task')
      expect((result as Task).id).toBe('task-for-hello')
    } finally {
      client.disconnect()
    }
  })

  test('getTask round-trip', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      const result = await client.getTask({ id: 'task-42' })
      expect(result.kind).toBe('task')
      expect(result.id).toBe('task-42')
      expect(result.status.state).toBe('completed')
    } finally {
      client.disconnect()
    }
  })

  test('cancelTask round-trip', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      const result = await client.cancelTask({ id: 'task-99' })
      expect(result.status.state).toBe('canceled')
    } finally {
      client.disconnect()
    }
  })

  test('sendStreamingMessage yields events until final', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      const events: StreamEvent[] = []
      for await (const event of client.sendStreamingMessage(msgParams('stream me'))) {
        events.push(event)
      }
      expect(events).toHaveLength(3)
      expect(events[0]).toHaveProperty('kind', 'status-update')
      expect(events[1]).toHaveProperty('kind', 'message')
      expect(events[2]).toHaveProperty('kind', 'status-update')
      // @ts-expect-error - accessing final on status-update event
      expect(events[2].final).toBe(true)
    } finally {
      client.disconnect()
    }
  })

  test('multiple sequential operations on same connection', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      const task1 = await client.sendMessage(msgParams('first'))
      const task2 = await client.sendMessage(msgParams('second'))
      expect((task1 as Task).id).toBe('task-for-first')
      expect((task2 as Task).id).toBe('task-for-second')
    } finally {
      client.disconnect()
    }
  })
})

// ── Error Handling ────────────────────────────────────────────────────────────

describe('WebSocket A2A Errors', () => {
  const minimalHandlers: A2AOperationHandlers = {
    sendMessage: async () => makeTask('task-1'),
  }

  let server: ReturnType<typeof Bun.serve>
  let wsUrl: string

  test('setup server', () => {
    const { websocket, handleUpgrade } = createA2AWebSocketHandler({ handlers: minimalHandlers })
    server = Bun.serve({
      port: 0,
      async fetch(req, srv) {
        if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
          return handleUpgrade(req, srv.upgrade.bind(srv))
        }
        return new Response('Not Found', { status: 404 })
      },
      websocket,
    })
    wsUrl = `ws://localhost:${server.port}`
  })

  afterAll(() => server?.stop(true))

  test('unimplemented method returns method_not_found', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      await client.getTask({ id: 'task-1' })
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { code: number }).code).toBe(-32601)
    } finally {
      client.disconnect()
    }
  })

  test('streaming on non-streaming server returns unsupported', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      for await (const _ of client.sendStreamingMessage(msgParams('test'))) {
        // Should error before yielding
      }
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { code: number }).code).toBe(-32004)
    } finally {
      client.disconnect()
    }
  })
})

// ── Handler Errors ────────────────────────────────────────────────────────────

describe('WebSocket A2A Handler Errors', () => {
  let server: ReturnType<typeof Bun.serve>
  let wsUrl: string

  test('setup server', () => {
    const { websocket, handleUpgrade } = createA2AWebSocketHandler({
      handlers: {
        sendMessage: async () => {
          throw new Error('Handler exploded')
        },
      },
    })
    server = Bun.serve({
      port: 0,
      async fetch(req, srv) {
        if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
          return handleUpgrade(req, srv.upgrade.bind(srv))
        }
        return new Response('Not Found', { status: 404 })
      },
      websocket,
    })
    wsUrl = `ws://localhost:${server.port}`
  })

  afterAll(() => server?.stop(true))

  test('handler exception returns internal error', async () => {
    const client = createA2AWebSocketClient({ url: wsUrl })
    try {
      await client.sendMessage(msgParams('boom'))
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { code: number }).code).toBe(-32603)
      expect((error as Error).message).toBe('Handler exploded')
    } finally {
      client.disconnect()
    }
  })
})

// ── Raw WebSocket Protocol ────────────────────────────────────────────────────

describe('WebSocket A2A Raw Protocol', () => {
  let server: ReturnType<typeof Bun.serve>
  let wsUrl: string

  test('setup server', () => {
    const { websocket, handleUpgrade } = createA2AWebSocketHandler({
      handlers: { sendMessage: async () => makeTask('task-raw') },
    })
    server = Bun.serve({
      port: 0,
      async fetch(req, srv) {
        if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
          return handleUpgrade(req, srv.upgrade.bind(srv))
        }
        return new Response('Not Found', { status: 404 })
      },
      websocket,
    })
    wsUrl = `ws://localhost:${server.port}`
  })

  afterAll(() => server?.stop(true))

  test('invalid JSON returns parse error', async () => {
    const ws = new WebSocket(wsUrl)
    await waitForOpen(ws)

    const response = new Promise<unknown>((resolve) => {
      ws.onmessage = (e) => resolve(JSON.parse(String(e.data)))
    })

    ws.send('not json')
    const json = (await response) as Record<string, unknown>
    expect((json.error as Record<string, unknown>).code).toBe(-32700)
    ws.close()
  })

  test('invalid JSON-RPC returns invalid request', async () => {
    const ws = new WebSocket(wsUrl)
    await waitForOpen(ws)

    const response = new Promise<unknown>((resolve) => {
      ws.onmessage = (e) => resolve(JSON.parse(String(e.data)))
    })

    ws.send(JSON.stringify({ not: 'valid rpc' }))
    const json = (await response) as Record<string, unknown>
    expect((json.error as Record<string, unknown>).code).toBe(-32600)
    ws.close()
  })

  test('push notification method returns push_notification_not_supported', async () => {
    const ws = new WebSocket(wsUrl)
    await waitForOpen(ws)

    const response = new Promise<unknown>((resolve) => {
      ws.onmessage = (e) => resolve(JSON.parse(String(e.data)))
    })

    ws.send(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tasks/pushNotificationConfig/set',
        params: {},
      }),
    )
    const json = (await response) as Record<string, unknown>
    expect((json.error as Record<string, unknown>).code).toBe(-32003)
    ws.close()
  })
})
