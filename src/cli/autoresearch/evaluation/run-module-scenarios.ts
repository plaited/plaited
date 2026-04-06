import type { Module, Signal } from '../../../agent/agent.types.ts'
import { createAgent } from '../../../agent/create-agent.ts'
import type { SnapshotMessage } from '../../../behavioral/behavioral.schemas.ts'
import {
  SERVER_MODULE_EVENTS,
  SERVER_MODULE_SIGNAL_KEYS,
} from '../../../modules/server-module/server-module.constants.ts'
import {
  ServerModuleConfigSchema,
  type ServerModuleStatusSchema,
} from '../../../modules/server-module/server-module.schemas.ts'
import { createServerModule } from '../../../modules/server-module/server-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

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

const collectSelectedTypes = (snapshots: SnapshotMessage[]): string[] =>
  snapshots.flatMap((snapshot) =>
    snapshot.kind === 'selection' ? snapshot.bids.filter((bid) => bid.selected).map((bid) => bid.type) : [],
  )

const runStartServeHealthScenario = async (): Promise<ModuleScenarioResult> => {
  let statusSignal!: Signal<typeof ServerModuleStatusSchema>

  const observeServerModule: Module = ({ signals }) => {
    statusSignal = signals.get(SERVER_MODULE_SIGNAL_KEYS.status) as Signal<typeof ServerModuleStatusSchema>
    return {}
  }

  const snapshots: SnapshotMessage[] = []
  const agent = await createAgent({
    id: 'agent:autoresearch-server-module-start',
    cwd: process.cwd(),
    workspace: process.cwd(),
    models: TEST_MODELS,
    modules: [
      createServerModule({
        initialConfig: {
          routes: {
            '/health': new Response('OK'),
          },
          authenticateConnection: () => ({ connectionId: 'test-connection' }),
          autostart: false,
        },
      }),
      ({ useSnapshot }) => {
        useSnapshot((snapshot) => {
          snapshots.push(snapshot)
        })
        return {}
      },
      observeServerModule,
    ],
  })

  try {
    agent.trigger({ type: SERVER_MODULE_EVENTS.server_start })
    await Bun.sleep(50)

    const port = statusSignal.get()?.port ?? 0
    const response = await fetch(`http://localhost:${port}/health`)
    const body = await response.text()
    const selectedTypes = collectSelectedTypes(snapshots)

    const invariants: ModuleScenarioInvariantResult[] = [
      {
        id: 'status-running',
        pass: (statusSignal.get()?.state ?? 'stopped') === 'running',
        reasoning: `Observed server status state=${statusSignal.get()?.state ?? 'undefined'}.`,
      },
      {
        id: 'server-start-selected',
        pass: selectedTypes.includes(SERVER_MODULE_EVENTS.server_start),
        reasoning: selectedTypes.includes(SERVER_MODULE_EVENTS.server_start)
          ? 'Snapshot trace includes selected server_start.'
          : 'Snapshot trace never showed selected server_start.',
      },
      {
        id: 'health-route-ok',
        pass: response.status === 200 && body === 'OK',
        reasoning: `GET /health returned status=${response.status} body=${JSON.stringify(body)}.`,
      },
    ]

    return {
      id: 'start-serve-health',
      pass: invariants.every((invariant) => invariant.pass),
      summary: 'Server starts from event and serves the baseline health route.',
      snapshots,
      invariants,
      transport: {
        healthStatus: response.status,
        healthBody: body,
        port,
      },
    }
  } finally {
    agent.trigger({ type: SERVER_MODULE_EVENTS.server_stop })
  }
}

const runReloadUpdatesRouteScenario = async (): Promise<ModuleScenarioResult> => {
  let statusSignal!: Signal<typeof ServerModuleStatusSchema>
  let configSignal!: Signal<typeof ServerModuleConfigSchema>

  const observeServerModule: Module = ({ signals }) => {
    statusSignal = signals.get(SERVER_MODULE_SIGNAL_KEYS.status) as Signal<typeof ServerModuleStatusSchema>
    configSignal = signals.get(SERVER_MODULE_SIGNAL_KEYS.config) as Signal<typeof ServerModuleConfigSchema>
    return {}
  }

  const snapshots: SnapshotMessage[] = []
  const agent = await createAgent({
    id: 'agent:autoresearch-server-module-reload',
    cwd: process.cwd(),
    workspace: process.cwd(),
    models: TEST_MODELS,
    modules: [
      createServerModule({
        initialConfig: {
          routes: {
            '/health': new Response('OK'),
          },
          authenticateConnection: () => ({ connectionId: 'test-connection' }),
          autostart: false,
        },
      }),
      ({ useSnapshot }) => {
        useSnapshot((snapshot) => {
          snapshots.push(snapshot)
        })
        return {}
      },
      observeServerModule,
    ],
  })

  try {
    agent.trigger({ type: SERVER_MODULE_EVENTS.server_start })
    await Bun.sleep(50)

    const updatedConfig = ServerModuleConfigSchema.parse({
      ...configSignal.get(),
      routes: {
        '/health': new Response('UPDATED'),
      },
    })
    configSignal.set?.(updatedConfig)
    agent.trigger({ type: SERVER_MODULE_EVENTS.server_reload })
    await Bun.sleep(50)

    const port = statusSignal.get()?.port ?? 0
    const response = await fetch(`http://localhost:${port}/health`)
    const body = await response.text()
    const selectedTypes = collectSelectedTypes(snapshots)

    const invariants: ModuleScenarioInvariantResult[] = [
      {
        id: 'status-running-after-reload',
        pass: (statusSignal.get()?.state ?? 'stopped') === 'running',
        reasoning: `Observed server status state=${statusSignal.get()?.state ?? 'undefined'} after reload.`,
      },
      {
        id: 'server-reload-selected',
        pass: selectedTypes.includes(SERVER_MODULE_EVENTS.server_reload),
        reasoning: selectedTypes.includes(SERVER_MODULE_EVENTS.server_reload)
          ? 'Snapshot trace includes selected server_reload.'
          : 'Snapshot trace never showed selected server_reload.',
      },
      {
        id: 'health-route-updated',
        pass: response.status === 200 && body === 'UPDATED',
        reasoning: `GET /health after reload returned status=${response.status} body=${JSON.stringify(body)}.`,
      },
    ]

    return {
      id: 'reload-updates-route',
      pass: invariants.every((invariant) => invariant.pass),
      summary: 'Server reload applies an updated route configuration.',
      snapshots,
      invariants,
      transport: {
        healthStatus: response.status,
        healthBody: body,
        port,
      },
    }
  } finally {
    agent.trigger({ type: SERVER_MODULE_EVENTS.server_stop })
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
      return [await runStartServeHealthScenario(), await runReloadUpdatesRouteScenario()]
    default:
      throw new Error(`No built-in module scenario suite is registered for target '${targetId}'`)
  }
}
