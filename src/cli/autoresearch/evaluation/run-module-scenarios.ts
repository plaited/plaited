import { behavioral, EXTENSION_REQUEST_EVENT, type SnapshotMessage, useInstaller } from '../../../behavioral.ts'
import { BRIDGE_UI_CORE_ID } from '../../../bridge-events.ts'
import { SERVER_MODULE_EVENTS, toServerModuleEventType } from '../../../modules/server/server-module.constants.ts'
import { type ServerStartDetail, ServerStartedDetailSchema } from '../../../modules/server/server-module.schemas.ts'
import type { AuthenticateConnection } from '../../../modules/server/server-module.types.ts'
import { serverModuleExtension } from '../../../modules.ts'

export type ModuleScenarioInvariantResult = {
  id: string
  pass: boolean
  reasoning: string
}

export type ModuleScenarioResult = {
  id: string
  pass: boolean
  summary: string
  snapshots: SnapshotMessage[]
  invariants: ModuleScenarioInvariantResult[]
  transport: Record<string, unknown>
}

type ObservedEvent = {
  type: string
  detail?: unknown
}

type ScenarioHarness = {
  events: ObservedEvent[]
  snapshots: SnapshotMessage[]
  trigger: (event: { type: string; detail?: unknown }) => void
  stop: () => Promise<void>
}

const SESSION_COOKIE = 'sid=autoresearch-session-id'
const serverStartEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_start)
const serverStopEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_stop)
const serverStartedEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_started)
const serverStoppedEventType = toServerModuleEventType(SERVER_MODULE_EVENTS.server_stopped)
const uiCoreExtensionRequestEventType = `${BRIDGE_UI_CORE_ID}:${EXTENSION_REQUEST_EVENT}`

const cookieAuth: AuthenticateConnection = ({ request }) => {
  const cookies = new Bun.CookieMap(request.headers.get('cookie') ?? '')
  const connectionId = cookies.get('sid')
  if (!connectionId) {
    return null
  }
  return {
    connectionId,
    principalId: 'autoresearch-principal',
  }
}

const wsUrl = (port: number) => `ws://localhost:${port}/ws`

const openWs = (
  port: number,
  { cookie = SESSION_COOKIE, protocol = 'document' }: { cookie?: string; protocol?: string } = {},
): WebSocket => {
  const headers: Record<string, string> = {
    Cookie: cookie,
    'Sec-WebSocket-Protocol': protocol,
  }

  // @ts-expect-error Bun supports headers in the constructor options.
  return new WebSocket(wsUrl(port), { headers }) as WebSocket
}

const waitForOpen = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.onopen = () => resolve()
    socket.onerror = (event) => reject(event)
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
}): Promise<ObservedEvent> => {
  const start = Date.now()
  while (Date.now() - start <= timeoutMs) {
    const match = events.slice(after).find((event) => event.type === type)
    if (match) {
      return match
    }
    await Bun.sleep(10)
  }
  const observedTypes = [...new Set(events.slice(after).map((event) => event.type))].join(', ')
  throw new Error(
    `Timed out waiting for event: ${type}${observedTypes.length > 0 ? ` (observed: ${observedTypes})` : ''}`,
  )
}

const createHarness = (): ScenarioHarness => {
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
    [serverStartedEventType]: (detail) => {
      events.push({ type: serverStartedEventType, detail })
    },
    [serverStoppedEventType]: (detail) => {
      events.push({ type: serverStoppedEventType, detail })
    },
    [uiCoreExtensionRequestEventType]: (detail) => {
      events.push({ type: uiCoreExtensionRequestEventType, detail })
    },
    user_action: (detail) => {
      events.push({ type: 'user_action', detail })
    },
    snapshot: (detail) => {
      events.push({ type: 'snapshot', detail })
    },
  })

  return {
    events,
    snapshots,
    trigger,
    stop: async () => {
      const after = events.length
      trigger({
        type: serverStopEventType,
        detail: {
          closeActiveConnections: true,
        },
      })
      try {
        await waitForEvent({
          events,
          type: serverStoppedEventType,
          after,
          timeoutMs: 1_000,
        })
      } catch {
        await Bun.sleep(10)
      }
    },
  }
}

const startServer = async (harness: ScenarioHarness, options: Partial<ServerStartDetail> = {}) => {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const after = harness.events.length
    harness.trigger({
      type: serverStartEventType,
      detail: {
        port: 0,
        authenticateConnection: cookieAuth,
        ...options,
      },
    })

    try {
      const started = await waitForEvent({
        events: harness.events,
        type: serverStartedEventType,
        after,
      })

      return ServerStartedDetailSchema.parse(started.detail)
    } catch (error) {
      const diagnostic = harness.snapshots
        .slice()
        .reverse()
        .find((snapshot) => snapshot.kind === 'extension_error' && snapshot.id === 'server_module')
      if (diagnostic?.kind === 'extension_error') {
        lastError = new Error(
          `Timed out waiting for ${serverStartedEventType}; latest server_module diagnostic: ${diagnostic.error}`,
        )
      } else {
        lastError = error as Error
      }
      await harness.stop()
    }
  }

  throw lastError ?? new Error('Failed to start server module for scenario harness.')
}

const collectSelectedTypes = (snapshots: SnapshotMessage[]): string[] =>
  snapshots.flatMap((snapshot) =>
    snapshot.kind === 'selection' ? snapshot.bids.filter((bid) => bid.selected).map((bid) => bid.type) : [],
  )

const runStartServeHealthScenario = async (): Promise<ModuleScenarioResult> => {
  const harness = createHarness()

  try {
    const started = await startServer(harness)
    const response = await fetch(`http://localhost:${started.port}/unknown`)
    const selectedTypes = collectSelectedTypes(harness.snapshots)

    const invariants: ModuleScenarioInvariantResult[] = [
      {
        id: 'server-started-port',
        pass: started.port > 0,
        reasoning: `Resolved server port=${started.port}.`,
      },
      {
        id: 'server-start-selected',
        pass: selectedTypes.includes(serverStartEventType),
        reasoning: selectedTypes.includes(serverStartEventType)
          ? 'Selection snapshots include the server_start event.'
          : 'Selection snapshots do not include server_start.',
      },
      {
        id: 'http-reachable',
        pass: response.status === 404,
        reasoning: `GET /unknown returned status=${response.status}.`,
      },
    ]

    return {
      id: 'server-start-http-reachable',
      pass: invariants.every((invariant) => invariant.pass),
      summary: 'Server module starts and serves HTTP requests on a resolved port.',
      snapshots: harness.snapshots,
      invariants,
      transport: {
        port: started.port,
        unknownStatus: response.status,
      },
    }
  } finally {
    await harness.stop()
  }
}

const runIngressEnvelopeScenario = async (): Promise<ModuleScenarioResult> => {
  const harness = createHarness()
  let socket: WebSocket | undefined

  try {
    const started = await startServer(harness)

    socket = openWs(started.port)
    await waitForOpen(socket)

    const before = harness.events.length
    const payload = {
      type: 'user_action',
      detail: {
        id: 'scenario-action',
        source: 'document',
        msg: 'click',
      },
    }
    socket.send(JSON.stringify(payload))

    const envelope = await waitForEvent({
      events: harness.events,
      type: uiCoreExtensionRequestEventType,
      after: before,
    })

    const envelopeDetail = envelope.detail as { type?: string; detail?: unknown } | undefined
    const eventsAfter = harness.events.slice(before)

    const invariants: ModuleScenarioInvariantResult[] = [
      {
        id: 'ui-core-envelope-emitted',
        pass: envelopeDetail?.type === 'user_action',
        reasoning: `Observed ui_core envelope type=${String(envelopeDetail?.type)}.`,
      },
      {
        id: 'raw-user-action-not-forwarded',
        pass: !eventsAfter.some((event) => event.type === 'user_action'),
        reasoning: eventsAfter.some((event) => event.type === 'user_action')
          ? 'Observed raw user_action event in runtime.'
          : 'No raw user_action event observed in runtime.',
      },
    ]

    return {
      id: 'websocket-ingress-envelope',
      pass: invariants.every((invariant) => invariant.pass),
      summary: 'Client websocket ingress is forwarded through the ui_core request envelope lane.',
      snapshots: harness.snapshots,
      invariants,
      transport: {
        port: started.port,
        envelopeType: envelopeDetail?.type,
      },
    }
  } finally {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close()
      await Bun.sleep(10)
    }
    await harness.stop()
  }
}

/**
 * Runs the deterministic built-in scenario suite for a supported module
 * target.
 *
 * @public
 */
export const runModuleScenarios = async ({ targetId }: { targetId: string }): Promise<ModuleScenarioResult[]> => {
  switch (targetId) {
    case 'server-module':
      return [await runStartServeHealthScenario(), await runIngressEnvelopeScenario()]
    default:
      throw new Error(`No built-in module scenario suite is registered for target '${targetId}'`)
  }
}
