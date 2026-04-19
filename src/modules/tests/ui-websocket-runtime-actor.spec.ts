import { afterEach, describe, expect, test } from 'bun:test'

import {
  behavioral,
  EXTENSION_REQUEST_EVENT,
  SNAPSHOT_MESSAGE_KINDS,
  type SnapshotMessage,
  useInstaller,
} from '../../behavioral.ts'
import { CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { uiWebSocketRuntimeActorExtension } from '../../modules.ts'
import {
  BRIDGE_UI_CORE_ID,
  toUiWebSocketRuntimeActorEventType,
  UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES,
  UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS,
  UI_WEBSOCKET_RUNTIME_ACTOR_ID,
  type UiWebSocketAuthenticateConnection,
  type UiWebSocketClientConnectedDetail,
  UiWebSocketClientConnectedDetailSchema,
  type UiWebSocketServerStartDetail,
  UiWebSocketServerStartedDetailSchema,
  type UiWebSocketServerStopDetail,
} from '../ui-websocket-runtime-actor.ts'

type ObservedEvent = { type: string; detail?: unknown }
type Harness = {
  events: ObservedEvent[]
  snapshots: SnapshotMessage[]
  trigger: (event: { type: string; detail?: unknown }) => void
}

const SESSION_COOKIE = 'sid=test-session-id'
const stopEventType = toUiWebSocketRuntimeActorEventType(UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_stop)
const startedEventType = toUiWebSocketRuntimeActorEventType(UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_started)
const connectedEventType = toUiWebSocketRuntimeActorEventType(UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_connected)
const clientErrorEventType = toUiWebSocketRuntimeActorEventType(UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_error)
const serverStartEventType = toUiWebSocketRuntimeActorEventType(UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_start)
const serverSendEventType = toUiWebSocketRuntimeActorEventType(UI_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_send)
const uiCoreExtensionRequestEventType = `${BRIDGE_UI_CORE_ID}:${EXTENSION_REQUEST_EVENT}`

const cleanupHarnesses: Pick<Harness, 'events' | 'trigger'>[] = []

const wsUrl = (port: number) => `ws://localhost:${port}/ws`

const cookieAuth: UiWebSocketAuthenticateConnection = ({ request }) => {
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
          snapshot.id === UI_WEBSOCKET_RUNTIME_ACTOR_ID &&
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

  useFeedback(install(uiWebSocketRuntimeActorExtension))
  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })
  useFeedback({
    [startedEventType]: (detail: unknown) => {
      events.push({ type: startedEventType, detail })
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
  })

  cleanupHarnesses.push({ events, trigger })
  return { events, snapshots, trigger }
}

const startServer = async (harness: Harness, options: Partial<UiWebSocketServerStartDetail> = {}) => {
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
  return UiWebSocketServerStartedDetailSchema.parse(started.detail)
}

afterEach(async () => {
  for (const harness of cleanupHarnesses.splice(0)) {
    harness.trigger({
      type: stopEventType,
      detail: {
        closeActiveConnections: true,
      } satisfies UiWebSocketServerStopDetail,
    })
  }
  await Bun.sleep(10)
})

describe('ui websocket runtime actor extension', () => {
  test('valid ui_event ingress routes to ui_core extension request and preserves p-topic source metadata', async () => {
    const harness = createHarness()
    const started = await startServer(harness)

    const socket = openWs(started.port, {
      protocol: 'test-island',
    })
    await waitForOpen(socket)

    const connected = await waitForEvent({
      events: harness.events,
      type: connectedEventType,
    })
    const connectedDetail: UiWebSocketClientConnectedDetail = UiWebSocketClientConnectedDetailSchema.parse(
      connected.detail,
    )
    expect(connectedDetail.source).toBe('test-island')

    const payload = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'click',
        detail: {
          id: 'submit',
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

    socket.close()
    await waitForClose(socket)
  })

  test('malformed websocket ingress publishes diagnostics and client_error observability', async () => {
    const harness = createHarness()
    const started = await startServer(harness)
    const socket = openWs(started.port, {
      protocol: 'test-island',
    })
    await waitForOpen(socket)

    const beforeMalformedSnapshot = harness.snapshots.length
    const beforeMalformedEvents = harness.events.length
    socket.send('not-json')

    const malformedDiagnostic = await waitForTransportDiagnostic({
      snapshots: harness.snapshots,
      code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
      after: beforeMalformedSnapshot,
    })
    expect(malformedDiagnostic.error).toContain('code=malformed_message')

    const malformedClientError = await waitForEvent({
      events: harness.events,
      type: clientErrorEventType,
      after: beforeMalformedEvents,
    })
    expect(malformedClientError.detail).toEqual(
      expect.objectContaining({
        code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
      }),
    )

    const beforeInvalidSnapshot = harness.snapshots.length
    socket.send(
      JSON.stringify({
        type: 'unsupported',
        detail: true,
      }),
    )

    const invalidDiagnostic = await waitForTransportDiagnostic({
      snapshots: harness.snapshots,
      code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
      after: beforeInvalidSnapshot,
    })
    expect(invalidDiagnostic.error).toContain('code=malformed_message')

    socket.close()
    await waitForClose(socket)
  })

  test('server_send replays buffered ui payloads and streams live controller messages by scoped topic', async () => {
    const harness = createHarness()
    const started = await startServer(harness, {
      replayBuffer: {
        maxSize: 4,
        ttlMs: 2_000,
      },
    })

    const protocol = 'test-island'
    const scopedTopic = `test-session-id:${protocol}`
    const bufferedPayload = JSON.stringify({
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
        topic: scopedTopic,
        data: bufferedPayload,
      },
    })

    const socket = openWs(started.port, { protocol })
    await waitForOpen(socket)

    const replayed = await nextJsonMessage(socket)
    expect(replayed).toEqual(JSON.parse(bufferedPayload))

    const livePayload = JSON.stringify({
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
        topic: scopedTopic,
        data: livePayload,
      },
    })

    expect(await liveMessage).toEqual(JSON.parse(livePayload))

    socket.close()
    await waitForClose(socket)
  })

  test('invalid server_send payload shape reports outbound diagnostics and does not publish', async () => {
    const harness = createHarness()
    const started = await startServer(harness)

    const socket = openWs(started.port, {
      protocol: 'test-island',
    })
    await waitForOpen(socket)

    const beforeSnapshot = harness.snapshots.length
    const beforeEvents = harness.events.length

    harness.trigger({
      type: serverSendEventType,
      detail: {
        topic: 'test-session-id:test-island',
        data: JSON.stringify({
          type: 'unknown_event',
          detail: {},
        }),
      },
    })

    const invalidOutbound = await waitForTransportDiagnostic({
      snapshots: harness.snapshots,
      code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_outbound_message,
      after: beforeSnapshot,
    })
    expect(invalidOutbound.error).toContain('code=invalid_outbound_message')

    const outboundClientError = await waitForEvent({
      events: harness.events,
      type: clientErrorEventType,
      after: beforeEvents,
    })
    expect(outboundClientError.detail).toEqual(
      expect.objectContaining({
        code: UI_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_outbound_message,
      }),
    )

    socket.close()
    await waitForClose(socket)
  })
})
