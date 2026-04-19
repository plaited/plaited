import { afterEach, describe, expect, test } from 'bun:test'
import { createAgent } from '../../../agent/create-agent.ts'
import {
  behavioral,
  EXTENSION_REQUEST_EVENT,
  isExtension,
  SNAPSHOT_MESSAGE_KINDS,
  type SnapshotMessage,
  useInstaller,
} from '../../../behavioral.ts'
import { CONTROLLER_TO_AGENT_EVENTS } from '../../../bridge-events.ts'
import { serverModuleExtension } from '../../../modules.ts'
import {
  type AuthenticateConnection,
  BRIDGE_UI_CORE_ID,
  ClientConnectedDetailSchema,
  SERVER_MODULE_ERROR_CODES,
  SERVER_MODULE_EVENTS,
  SERVER_MODULE_ID,
  type ServerStartDetail,
  ServerStartedDetailSchema,
  toServerModuleEventType,
} from '../../server.ts'

type ObservedEvent = { type: string; detail?: unknown }
type Harness = {
  events: ObservedEvent[]
  snapshots: SnapshotMessage[]
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
const uiCoreExtensionRequestEventType = `${BRIDGE_UI_CORE_ID}:${EXTENSION_REQUEST_EVENT}`
const uiCoreUserActionEventType = `${BRIDGE_UI_CORE_ID}:user_action`
const uiCoreSnapshotEventType = `${BRIDGE_UI_CORE_ID}:snapshot`

const cleanupHarnesses: Pick<Harness, 'events' | 'trigger'>[] = []

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

const waitForNoMessage = async (socket: WebSocket, timeoutMs = 120) => {
  let messageSeen = false
  const onMessage = () => {
    messageSeen = true
  }
  socket.addEventListener('message', onMessage)
  await Bun.sleep(timeoutMs)
  socket.removeEventListener('message', onMessage)
  expect(messageSeen).toBe(false)
}

const waitForEvent = async ({
  events,
  type,
  after = 0,
  timeoutMs = 5_000,
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

const waitForTransportDiagnostic = async ({
  snapshots,
  code,
  after = 0,
  timeoutMs = 5_000,
}: {
  snapshots: SnapshotMessage[]
  code: string
  after?: number
  timeoutMs?: number
}) => {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const match = snapshots
      .slice(after)
      .find(
        (snapshot) =>
          snapshot.kind === SNAPSHOT_MESSAGE_KINDS.extension_error &&
          snapshot.id === SERVER_MODULE_ID &&
          snapshot.error.includes(`code=${code}`),
      )
    if (match && match.kind === SNAPSHOT_MESSAGE_KINDS.extension_error) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for extension_error diagnostic with code "${code}"`)
}

const createHarness = (): Harness => {
  const events: ObservedEvent[] = []
  const snapshots: SnapshotMessage[] = []
  const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
  const install = useInstaller({
    trigger,
    useSnapshot,
    reportSnapshot,
    addBThread,
    ttlMs: 1_000,
  })

  useFeedback(install(serverModuleExtension))
  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })
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
    [uiCoreExtensionRequestEventType]: (detail: unknown) => {
      events.push({ type: uiCoreExtensionRequestEventType, detail })
    },
    [uiCoreUserActionEventType]: (detail: unknown) => {
      events.push({ type: uiCoreUserActionEventType, detail })
    },
    [uiCoreSnapshotEventType]: (detail: unknown) => {
      events.push({ type: uiCoreSnapshotEventType, detail })
    },
    user_action: (detail: unknown) => {
      events.push({ type: 'user_action', detail })
    },
    snapshot: (detail: unknown) => {
      events.push({ type: 'snapshot', detail })
    },
  })

  cleanupHarnesses.push({ events, trigger })
  return { events, snapshots, trigger }
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
  for (const harness of cleanupHarnesses.splice(0)) {
    const after = harness.events.length
    harness.trigger({
      type: stopEventType,
      detail: {
        closeActiveConnections: true,
      },
    })
    try {
      await waitForEvent({
        events: harness.events,
        type: stoppedEventType,
        after,
        timeoutMs: 300,
      })
    } catch {
      // some tests never start a server, so no stop event is expected
    }
  }
  await Bun.sleep(10)
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

  test('schema-invalid server_start and server_send are blocked while valid events still flow', async () => {
    const harness = createHarness()
    const beforeInvalidStart = harness.events.length

    harness.trigger({
      type: serverStartEventType,
      detail: {
        port: 0,
      },
    } as unknown as { type: string; detail?: unknown })

    await Bun.sleep(50)
    expect(harness.events.slice(beforeInvalidStart).some((event) => event.type === startedEventType)).toBe(false)

    const started = await startServer(harness)
    const socket = openWs(started.port)
    await waitForOpen(socket)

    harness.trigger({
      type: serverSendEventType,
      detail: {
        topic: 'test-session-id',
        data: 7,
      },
    } as unknown as { type: string; detail?: unknown })
    await waitForNoMessage(socket)

    const validPayload = JSON.stringify({
      type: 'render',
      detail: {
        target: 'main',
        html: '<p>ok</p>',
        stylesheets: [],
        registry: [],
      },
    })
    const validMessage = nextJsonMessage(socket)
    harness.trigger({
      type: serverSendEventType,
      detail: {
        topic: 'test-session-id',
        data: validPayload,
      },
    })
    expect(await validMessage).toEqual(JSON.parse(validPayload))

    socket.close()
    await waitForClose(socket)
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

  test('malformed JSON and schema-invalid client messages emit extension_error diagnostics and not client_error events', async () => {
    const harness = createHarness()
    const started = await startServer(harness)
    const socket = openWs(started.port)
    await waitForOpen(socket)

    const beforeMalformedSnapshots = harness.snapshots.length
    const beforeMalformedEvents = harness.events.length
    socket.send('not-json')
    const malformedDiagnostic = await waitForTransportDiagnostic({
      snapshots: harness.snapshots,
      code: SERVER_MODULE_ERROR_CODES.malformed_message,
      after: beforeMalformedSnapshots,
    })
    expect(malformedDiagnostic.error).toContain('code=malformed_message')
    expect(harness.events.slice(beforeMalformedEvents).some((event) => event.type === clientErrorEventType)).toBe(false)

    const beforeInvalidSnapshots = harness.snapshots.length
    const beforeInvalidEvents = harness.events.length
    socket.send(
      JSON.stringify({
        type: 'unknown_event',
        detail: { nope: true },
      }),
    )
    const invalidDiagnostic = await waitForTransportDiagnostic({
      snapshots: harness.snapshots,
      code: SERVER_MODULE_ERROR_CODES.malformed_message,
      after: beforeInvalidSnapshots,
    })
    expect(invalidDiagnostic.error).toContain('code=malformed_message')
    expect(harness.events.slice(beforeInvalidEvents).some((event) => event.type === clientErrorEventType)).toBe(false)

    expect(socket.readyState).toBe(WebSocket.OPEN)
    socket.close()
    await waitForClose(socket)
  })

  test('ui_event ingress emits the ui_core extension_request_event envelope', async () => {
    const harness = createHarness()
    const started = await startServer(harness)
    const socket = openWs(started.port)
    await waitForOpen(socket)

    const payload = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'click',
        detail: {
          'p-trigger': 'click:click',
        },
      },
    } as const
    const before = harness.events.length
    socket.send(JSON.stringify(payload))

    const forwarded = await waitForEvent({
      events: harness.events,
      type: uiCoreExtensionRequestEventType,
      after: before,
    })
    expect(forwarded.detail).toEqual(
      expect.objectContaining({
        type: payload.type,
        detail: payload.detail,
      }),
    )
    expect(harness.events.slice(before).some((event) => event.type === CONTROLLER_TO_AGENT_EVENTS.ui_event)).toBe(false)
    expect(harness.events.slice(before).some((event) => event.type === uiCoreUserActionEventType)).toBe(false)

    socket.close()
    await waitForClose(socket)
  })

  test('error ingress emits the ui_core extension_request_event envelope', async () => {
    const harness = createHarness()
    const started = await startServer(harness)
    const socket = openWs(started.port)
    await waitForOpen(socket)

    const payload = {
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: 'controller import failed',
    } as const
    const before = harness.events.length
    socket.send(JSON.stringify(payload))

    const forwarded = await waitForEvent({
      events: harness.events,
      type: uiCoreExtensionRequestEventType,
      after: before,
    })
    expect(forwarded.detail).toEqual(
      expect.objectContaining({
        type: payload.type,
        detail: payload.detail,
      }),
    )
    expect(harness.events.slice(before).some((event) => event.type === CONTROLLER_TO_AGENT_EVENTS.error)).toBe(false)
    expect(harness.events.slice(before).some((event) => event.type === uiCoreSnapshotEventType)).toBe(false)

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
        stylesheets: [],
        registry: [],
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
