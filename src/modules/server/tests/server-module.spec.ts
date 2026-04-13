import { afterEach, describe, expect, test } from 'bun:test'
import { createAgent } from '../../../agent/create-agent.ts'
import { behavioral, isExtension, useInstaller } from '../../../behavioral.ts'
import { serverModuleExtension } from '../../../modules.ts'
import { SERVER_MODULE_ERROR_CODES, SERVER_MODULE_EVENTS, toServerModuleEventType } from '../server-module.constants.ts'
import {
  ClientConnectedDetailSchema,
  ClientErrorDetailSchema,
  type ServerStartDetail,
  ServerStartedDetailSchema,
} from '../server-module.schemas.ts'
import type { AuthenticateConnection } from '../server-module.types.ts'

type ObservedEvent = { type: string; detail?: unknown }
type Harness = {
  events: ObservedEvent[]
  trigger: (event: { type: string; detail?: unknown }) => void
}

const SESSION_COOKIE = 'sid=test-session-id'
const stopEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_stop)
const startedEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_started)
const stoppedEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_stopped)
const connectedEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.client_connected)
const clientErrorEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.client_error)
const serverStartEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_start)
const serverSendEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_send)

const cleanupTriggers: Harness['trigger'][] = []

const wsUrl = (port: number) => `ws://localhost:${port}/ws`

const cookieAuth: AuthenticateConnection = ({ request }) => {
  const cookies = new Bun.CookieMap(request.headers.get('cookie') ?? '')
  const connectionId = cookies.get('sid')
  if (!connectionId) {
    return null
  }
  return {
    connectionId,
    principalId: 'test-principal',
  }
}

const openWs = (
  port: number,
  {
    cookie = SESSION_COOKIE,
    origin,
    protocol = 'document',
  }: { cookie?: string; origin?: string; protocol?: string } = {},
) => {
  const headers: Record<string, string> = {
    Cookie: cookie,
    'Sec-WebSocket-Protocol': protocol,
  }
  if (origin) {
    headers.Origin = origin
  }
  // @ts-expect-error Bun supports headers in the constructor options.
  return new WebSocket(wsUrl(port), { headers }) as WebSocket
}

const waitForOpen = (socket: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve()
    socket.onerror = (event) => reject(event)
  })

const waitForClose = (socket: WebSocket) =>
  new Promise<void>((resolve) => {
    socket.onclose = () => resolve()
  })

const nextJsonMessage = (socket: WebSocket) =>
  new Promise<unknown>((resolve) => {
    socket.onmessage = (event) => resolve(JSON.parse(String(event.data)))
  })

const waitForEvent = async ({
  events,
  type,
  after = 0,
  timeoutMs = 2_000,
}: {
  events: ObservedEvent[]
  type: string
  after?: number
  timeoutMs?: number
}) => {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const match = events.slice(after).find((event) => event.type === type)
    if (match) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for "${type}"`)
}

const createHarness = (): Harness => {
  const events: ObservedEvent[] = []
  const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
  const install = useInstaller({
    trigger,
    useSnapshot,
    reportSnapshot,
    addBThread,
    ttlMs: 1_000,
  })

  useFeedback(install(serverModuleExtension))
  useFeedback({
    [startedEventType]: (detail: unknown) => {
      events.push({ type: startedEventType, detail })
    },
    [stoppedEventType]: (detail: unknown) => {
      events.push({ type: stoppedEventType, detail })
    },
    [connectedEventType]: (detail: unknown) => {
      events.push({ type: connectedEventType, detail })
    },
    [clientErrorEventType]: (detail: unknown) => {
      events.push({ type: clientErrorEventType, detail })
    },
    user_action: (detail: unknown) => {
      events.push({ type: 'user_action', detail })
    },
    snapshot: (detail: unknown) => {
      events.push({ type: 'snapshot', detail })
    },
  })

  cleanupTriggers.push(trigger)
  return { events, trigger }
}

const startServer = async (harness: Harness, options: Partial<ServerStartDetail> = {}) => {
  harness.trigger({
    type: serverStartEventType,
    detail: {
      port: 0,
      authenticateConnection: cookieAuth,
      ...options,
    },
  })

  const started = await waitForEvent({
    events: harness.events,
    type: startedEventType,
  })
  return ServerStartedDetailSchema.parse(started.detail)
}

afterEach(async () => {
  for (const trigger of cleanupTriggers.splice(0)) {
    trigger({
      type: stopEventType,
      detail: {
        closeActiveConnections: true,
      },
    })
  }
  await Bun.sleep(20)
})

describe('server module extension', () => {
  test('importing and installing exported extension is inert until server_start', async () => {
    expect(isExtension(serverModuleExtension)).toBe(true)

    const originalServe = Bun.serve
    let serveCalls = 0
    Bun.serve = ((...args: Parameters<typeof Bun.serve>) => {
      serveCalls += 1
      return originalServe(...args)
    }) as typeof Bun.serve

    try {
      await createAgent({
        workspace: process.cwd(),
        ttlMs: 1_000,
      })
      expect(serveCalls).toBe(0)
    } finally {
      Bun.serve = originalServe
    }
  })

  test('server_start boots on port 0 and emits server_started with the resolved port', async () => {
    const harness = createHarness()
    const started = await startServer(harness)

    expect(started.port).toBeGreaterThan(0)

    const response = await fetch(`http://localhost:${started.port}/unknown`)
    expect(response.status).toBe(404)
  })

  test('valid websocket protocol plus auth emits scoped client_connected lifecycle', async () => {
    const harness = createHarness()
    const started = await startServer(harness, {
      allowedOrigins: new Set(['http://localhost:3000']),
    })

    const socket = openWs(started.port, {
      origin: 'http://localhost:3000',
      protocol: 'document',
    })

    await waitForOpen(socket)
    const connected = await waitForEvent({
      events: harness.events,
      type: connectedEventType,
    })
    const detail = ClientConnectedDetailSchema.parse(connected.detail)
    expect(detail.connectionId).toBe('test-session-id')
    expect(detail.source).toBe('document')

    socket.close()
    await waitForClose(socket)
  })

  test('malformed JSON and schema-invalid client messages emit scoped client_error without throwing', async () => {
    const harness = createHarness()
    const started = await startServer(harness)
    const socket = openWs(started.port)
    await waitForOpen(socket)

    const beforeMalformed = harness.events.length
    socket.send('not-json')
    const malformed = await waitForEvent({
      events: harness.events,
      type: clientErrorEventType,
      after: beforeMalformed,
    })
    expect(ClientErrorDetailSchema.parse(malformed.detail).code).toBe(SERVER_MODULE_ERROR_CODES.malformed_message)

    const beforeInvalid = harness.events.length
    socket.send(
      JSON.stringify({
        type: 'unknown_event',
        detail: { nope: true },
      }),
    )
    const invalid = await waitForEvent({
      events: harness.events,
      type: clientErrorEventType,
      after: beforeInvalid,
    })
    expect(ClientErrorDetailSchema.parse(invalid.detail).code).toBe(SERVER_MODULE_ERROR_CODES.malformed_message)

    expect(socket.readyState).toBe(WebSocket.OPEN)
    socket.close()
    await waitForClose(socket)
  })

  test('valid ClientMessageSchema payload is triggered into the engine unchanged', async () => {
    const harness = createHarness()
    const started = await startServer(harness)
    const socket = openWs(started.port)
    await waitForOpen(socket)

    const payload = {
      type: 'user_action',
      detail: {
        id: 'action-1',
        source: 'document',
        msg: 'click',
      },
    } as const
    const before = harness.events.length
    socket.send(JSON.stringify(payload))

    const forwarded = await waitForEvent({
      events: harness.events,
      type: 'user_action',
      after: before,
    })
    expect(forwarded.detail).toEqual(payload.detail)

    socket.close()
    await waitForClose(socket)
  })

  test('server_send publishes by topic and replays buffered messages on reconnect gaps', async () => {
    const harness = createHarness()
    const started = await startServer(harness, {
      replayBuffer: {
        maxSize: 4,
        ttlMs: 2_000,
      },
    })

    const buffered = JSON.stringify({
      type: 'render',
      detail: {
        target: 'main',
        html: '<p>buffered</p>',
      },
    })
    harness.trigger({
      type: serverSendEventType,
      detail: {
        topic: 'test-session-id',
        data: buffered,
      },
    })

    const socket = openWs(started.port, { protocol: 'document' })
    await waitForOpen(socket)
    const replayed = await nextJsonMessage(socket)
    expect(replayed).toEqual(JSON.parse(buffered))

    const live = JSON.stringify({
      type: 'attrs',
      detail: {
        target: 'main',
        attr: { class: 'live' },
      },
    })
    const liveMessage = nextJsonMessage(socket)
    harness.trigger({
      type: serverSendEventType,
      detail: {
        topic: 'test-session-id',
        data: live,
      },
    })
    expect(await liveMessage).toEqual(JSON.parse(live))

    socket.close()
    await waitForClose(socket)
  })

  test('server_stop halts the live server and emits server_stopped', async () => {
    const harness = createHarness()
    const started = await startServer(harness)

    const before = harness.events.length
    harness.trigger({
      type: stopEventType,
      detail: {
        closeActiveConnections: true,
      },
    })
    await waitForEvent({
      events: harness.events,
      type: stoppedEventType,
      after: before,
    })

    await Bun.sleep(20)

    let fetchFailed = false
    try {
      await fetch(`http://localhost:${started.port}/after-stop`)
    } catch {
      fetchFailed = true
    }

    expect(fetchFailed).toBe(true)
  })
})
