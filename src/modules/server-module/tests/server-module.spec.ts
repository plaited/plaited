import { afterEach, describe, expect, test } from 'bun:test'
import type { Module, Signal } from '../../../agent/agent.types.ts'
import { createAgent } from '../../../agent/create-agent.ts'
import { SERVER_MODULE_EVENTS, SERVER_MODULE_SIGNAL_KEYS } from '../server-module.constants.ts'
import { ServerModuleConfigSchema, type ServerModuleStatusSchema } from '../server-module.schemas.ts'
import { createServerModule } from '../server-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

const runningAgents: Array<Awaited<ReturnType<typeof createAgent>>> = []

afterEach(() => {
  for (const agent of runningAgents.splice(0)) {
    agent.trigger({ type: SERVER_MODULE_EVENTS.server_stop })
  }
})

describe('createServerModule', () => {
  test('starts from a behavioral event and serves routes', async () => {
    let statusSignal!: Signal<typeof ServerModuleStatusSchema>

    const observeServerModule: Module = ({ signals }) => {
      statusSignal = signals.get(SERVER_MODULE_SIGNAL_KEYS.status) as Signal<typeof ServerModuleStatusSchema>
      return {}
    }

    const agent = await createAgent({
      id: 'agent:test-server-module',
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
        observeServerModule,
      ],
    })
    runningAgents.push(agent)

    agent.trigger({ type: SERVER_MODULE_EVENTS.server_start })
    await Bun.sleep(50)

    const runningPort = statusSignal.get()?.port ?? 0
    expect(runningPort).toBeGreaterThan(0)
    const response = await fetch(`http://localhost:${runningPort}/health`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })

  test('reloads when the config signal changes', async () => {
    let statusSignal!: Signal<typeof ServerModuleStatusSchema>
    let configSignal!: Signal<typeof ServerModuleConfigSchema>

    const mutateConfigModule: Module = ({ signals }) => {
      configSignal = signals.get(SERVER_MODULE_SIGNAL_KEYS.config) as Signal<typeof ServerModuleConfigSchema>
      statusSignal = signals.get(SERVER_MODULE_SIGNAL_KEYS.status) as Signal<typeof ServerModuleStatusSchema>
      return {}
    }

    const agent = await createAgent({
      id: 'agent:test-server-module-reload',
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
        mutateConfigModule,
      ],
    })
    runningAgents.push(agent)

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

    const runningPort = statusSignal.get()?.port ?? 0
    expect(runningPort).toBeGreaterThan(0)
    const response = await fetch(`http://localhost:${runningPort}/health`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('UPDATED')
  })
})
