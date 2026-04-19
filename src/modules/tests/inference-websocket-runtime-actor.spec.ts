import { afterEach, describe, expect, test } from 'bun:test'

import {
  type ActorEnvelope,
  behavioral,
  EXTENSION_REQUEST_EVENT,
  SNAPSHOT_MESSAGE_KINDS,
  type SnapshotMessage,
  useInstaller,
} from '../../behavioral.ts'
import { inferenceWebSocketRuntimeActorExtension } from '../../modules.ts'
import {
  BRIDGE_INFERENCE_CORE_ID,
  INFERENCE_CORE_EVENTS,
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES,
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS,
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID,
  InferenceEnvelopeReceivedDetailSchema,
  type InferenceWebSocketAuthenticateConnection,
  type InferenceWebSocketServerStartDetail,
  InferenceWebSocketServerStartedDetailSchema,
  type InferenceWebSocketServerStopDetail,
  toInferenceWebSocketRuntimeActorEventType,
} from '../inference-websocket-runtime-actor.ts'

type ObservedEvent = { type: string; detail?: unknown }
type Harness = {
  events: ObservedEvent[]
  snapshots: SnapshotMessage[]
  trigger: (event: { type: string; detail?: unknown }) => void
}

const SESSION_COOKIE = 'sid=test-session-id'
const stopEventType = toInferenceWebSocketRuntimeActorEventType(INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_stop)
const startedEventType = toInferenceWebSocketRuntimeActorEventType(
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_started,
)
const clientErrorEventType = toInferenceWebSocketRuntimeActorEventType(
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.client_error,
)
const envelopeReceivedEventType = toInferenceWebSocketRuntimeActorEventType(
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.envelope_received,
)
const serverStartEventType = toInferenceWebSocketRuntimeActorEventType(
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.server_start,
)
const envelopeSendEventType = toInferenceWebSocketRuntimeActorEventType(
  INFERENCE_WEBSOCKET_RUNTIME_ACTOR_EVENTS.envelope_send,
)
const inferenceCoreExtensionRequestEventType = `${BRIDGE_INFERENCE_CORE_ID}:${EXTENSION_REQUEST_EVENT}`

const cleanupHarnesses: Pick<Harness, 'events' | 'trigger'>[] = []

const wsUrl = (port: number) => `ws://localhost:${port}/ws/inference`

const cookieAuth: InferenceWebSocketAuthenticateConnection = ({ request }) => {
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
    protocol = 'inference-stream',
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
          snapshot.id === INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID &&
          snapshot.error.includes(`code=${code}`),
      )
    if (match && match.kind === SNAPSHOT_MESSAGE_KINDS.extension_error) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for extension_error diagnostic with code "${code}"`)
}

const waitForActorDiagnostic = async ({
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
          snapshot.id === INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ID &&
          snapshot.error.includes('runtime actor diagnostic') &&
          snapshot.error.includes(`code=${code}`),
      )
    if (match && match.kind === SNAPSHOT_MESSAGE_KINDS.extension_error) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for actor diagnostic with code "${code}"`)
}

const waitForFeedbackError = async ({
  snapshots,
  type,
  after = 0,
  timeoutMs = 5_000,
}: {
  snapshots: SnapshotMessage[]
  type: string
  after?: number
  timeoutMs?: number
}) => {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const match = snapshots
      .slice(after)
      .find((snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error && snapshot.type === type)
    if (match && match.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for feedback_error snapshot for "${type}"`)
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

  useFeedback(install(inferenceWebSocketRuntimeActorExtension))
  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })
  useFeedback({
    [startedEventType]: (detail: unknown) => {
      events.push({ type: startedEventType, detail })
    },
    [clientErrorEventType]: (detail: unknown) => {
      events.push({ type: clientErrorEventType, detail })
    },
    [envelopeReceivedEventType]: (detail: unknown) => {
      events.push({ type: envelopeReceivedEventType, detail })
    },
    [inferenceCoreExtensionRequestEventType]: (detail: unknown) => {
      events.push({ type: inferenceCoreExtensionRequestEventType, detail })
    },
  })

  cleanupHarnesses.push({ events, trigger })
  return { events, snapshots, trigger }
}

const startServer = async (harness: Harness, options: Partial<InferenceWebSocketServerStartDetail> = {}) => {
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
  return InferenceWebSocketServerStartedDetailSchema.parse(started.detail)
}

const createEnvelope = ({
  id,
  source,
  target,
}: {
  id: string
  source?: ActorEnvelope['source']
  target?: ActorEnvelope['target']
}): ActorEnvelope => ({
  id,
  type: 'inference:response',
  source:
    source ??
    ({
      id: 'inference:runtime',
      kind: 'inference',
    } as const),
  target:
    target ??
    ({
      id: 'supervisor:domain:node-local',
      kind: 'supervisor',
    } as const),
  detail: {
    content: 'hello',
    tokens: 3,
  },
  meta: {
    purpose: 'model_response',
    boundary: 'domain:node-local',
  },
})

afterEach(async () => {
  for (const harness of cleanupHarnesses.splice(0)) {
    harness.trigger({
      type: stopEventType,
      detail: {
        closeActiveConnections: true,
      } satisfies InferenceWebSocketServerStopDetail,
    })
  }
  await Bun.sleep(10)
})

describe('inference websocket runtime actor extension', () => {
  test('valid inference envelope ingress remains replayable and preserves source provenance', async () => {
    const harness = createHarness()
    const started = await startServer(harness)

    const socket = openWs(started.port, {
      protocol: 'assistant-stream',
    })
    await waitForOpen(socket)

    const envelope = createEnvelope({
      id: 'env-ingress-1',
      source: {
        id: 'inference:model-router',
        kind: 'inference',
      },
    })

    const before = harness.events.length
    socket.send(JSON.stringify(envelope))

    const received = await waitForEvent({
      events: harness.events,
      type: envelopeReceivedEventType,
      after: before,
    })
    const receivedDetail = InferenceEnvelopeReceivedDetailSchema.parse(received.detail)
    expect(receivedDetail.envelope.source).toEqual(envelope.source)

    const forwarded = await waitForEvent({
      events: harness.events,
      type: inferenceCoreExtensionRequestEventType,
      after: before,
    })
    expect(forwarded.detail).toEqual(
      expect.objectContaining({
        type: INFERENCE_CORE_EVENTS.envelope_received,
        detail: receivedDetail,
      }),
    )

    socket.close()
    await waitForClose(socket)
  })

  test('malformed inference websocket ingress emits diagnostics and client_error events', async () => {
    const harness = createHarness()
    const started = await startServer(harness)

    const socket = openWs(started.port)
    await waitForOpen(socket)

    const beforeMalformedSnapshot = harness.snapshots.length
    const beforeMalformedEvents = harness.events.length
    socket.send('not-json')

    const malformedDiagnostic = await waitForTransportDiagnostic({
      snapshots: harness.snapshots,
      code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
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
        code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.malformed_message,
      }),
    )

    const beforeInvalidEnvelopeSnapshot = harness.snapshots.length
    socket.send(
      JSON.stringify({
        type: 'inference:response',
        source: {
          id: 'inference:model-router',
          kind: 'inference',
        },
      }),
    )

    const invalidEnvelopeDiagnostic = await waitForTransportDiagnostic({
      snapshots: harness.snapshots,
      code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.invalid_envelope,
      after: beforeInvalidEnvelopeSnapshot,
    })
    expect(invalidEnvelopeDiagnostic.error).toContain('code=invalid_envelope')

    socket.close()
    await waitForClose(socket)
  })

  test('envelope_send replays queued envelopes and streams live envelopes by scoped inference topic', async () => {
    const harness = createHarness()
    const started = await startServer(harness, {
      replayBuffer: {
        maxSize: 4,
        ttlMs: 2_000,
      },
    })

    const protocol = 'assistant-stream'
    const scopedTopic = `test-session-id:${protocol}`
    const bufferedEnvelope = createEnvelope({ id: 'env-buffered-1' })

    harness.trigger({
      type: envelopeSendEventType,
      detail: {
        topic: scopedTopic,
        envelope: bufferedEnvelope,
      },
    })

    const socket = openWs(started.port, { protocol })
    await waitForOpen(socket)

    const replayed = await nextJsonMessage(socket)
    expect(replayed).toEqual(bufferedEnvelope)

    const liveEnvelope = createEnvelope({ id: 'env-live-1' })
    const liveMessage = nextJsonMessage(socket)
    harness.trigger({
      type: envelopeSendEventType,
      detail: {
        topic: scopedTopic,
        envelope: liveEnvelope,
      },
    })

    expect(await liveMessage).toEqual(liveEnvelope)

    socket.close()
    await waitForClose(socket)
  })

  test('envelope_send without an active server reports actor diagnostics only', async () => {
    const harness = createHarness()
    const beforeSnapshots = harness.snapshots.length
    const beforeEvents = harness.events.length

    harness.trigger({
      type: envelopeSendEventType,
      detail: {
        topic: 'test-session-id:assistant-stream',
        envelope: createEnvelope({ id: 'env-no-server-1' }),
      },
    })

    const actorDiagnostic = await waitForActorDiagnostic({
      snapshots: harness.snapshots,
      code: INFERENCE_WEBSOCKET_RUNTIME_ACTOR_ERROR_CODES.server_not_running,
      after: beforeSnapshots,
    })
    expect(actorDiagnostic.error).toContain('code=server_not_running')

    await Bun.sleep(100)
    expect(harness.events.slice(beforeEvents).some((event) => event.type === clientErrorEventType)).toBe(false)
  })

  test('invalid internal envelope_send detail surfaces as feedback_error', async () => {
    const harness = createHarness()
    await startServer(harness)

    const beforeSnapshot = harness.snapshots.length
    const beforeEvents = harness.events.length

    harness.trigger({
      type: envelopeSendEventType,
      detail: {
        topic: 'test-session-id:assistant-stream',
        envelope: {
          ...createEnvelope({ id: 'env-invalid-send-1' }),
          detail: {
            fn: () => 1,
          },
        },
      },
    })

    const invalidControlDiagnostic = await waitForFeedbackError({
      snapshots: harness.snapshots,
      type: envelopeSendEventType,
      after: beforeSnapshot,
    })
    expect(invalidControlDiagnostic.error.length).toBeGreaterThan(0)

    await Bun.sleep(100)
    expect(harness.events.slice(beforeEvents).some((event) => event.type === clientErrorEventType)).toBe(false)
  })
})
