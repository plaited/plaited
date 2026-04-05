import { afterEach, describe, expect, test } from 'bun:test'
import type { Factory, Signal } from '../../../agent/agent.types.ts'
import { createAgent } from '../../../agent/create-agent.ts'
import { SERVER_FACTORY_EVENTS, SERVER_FACTORY_SIGNAL_KEYS } from '../server-factory.constants.ts'
import { ServerFactoryConfigSchema, type ServerFactoryStatusSchema } from '../server-factory.schemas.ts'
import { createServerFactory } from '../server-factory.ts'

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
    agent.trigger({ type: SERVER_FACTORY_EVENTS.server_stop })
  }
})

describe('createServerFactory', () => {
  test('starts from a behavioral event and serves routes', async () => {
    let statusSignal!: Signal<typeof ServerFactoryStatusSchema>

    const observeServerFactory: Factory = ({ signals }) => {
      statusSignal = signals.get(SERVER_FACTORY_SIGNAL_KEYS.status) as Signal<typeof ServerFactoryStatusSchema>
      return {}
    }

    const agent = await createAgent({
      id: 'agent:test-server-factory',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createServerFactory({
          initialConfig: {
            routes: {
              '/health': new Response('OK'),
            },
            authenticateConnection: () => ({ connectionId: 'test-connection' }),
            autostart: false,
          },
        }),
        observeServerFactory,
      ],
    })
    runningAgents.push(agent)

    agent.trigger({ type: SERVER_FACTORY_EVENTS.server_start })
    await Bun.sleep(50)

    const runningPort = statusSignal.get()?.port ?? 0
    expect(runningPort).toBeGreaterThan(0)
    const response = await fetch(`http://localhost:${runningPort}/health`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })

  test('reloads when the config signal changes', async () => {
    let statusSignal!: Signal<typeof ServerFactoryStatusSchema>
    let configSignal!: Signal<typeof ServerFactoryConfigSchema>

    const mutateConfigFactory: Factory = ({ signals }) => {
      configSignal = signals.get(SERVER_FACTORY_SIGNAL_KEYS.config) as Signal<typeof ServerFactoryConfigSchema>
      statusSignal = signals.get(SERVER_FACTORY_SIGNAL_KEYS.status) as Signal<typeof ServerFactoryStatusSchema>
      return {}
    }

    const agent = await createAgent({
      id: 'agent:test-server-factory-reload',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createServerFactory({
          initialConfig: {
            routes: {
              '/health': new Response('OK'),
            },
            authenticateConnection: () => ({ connectionId: 'test-connection' }),
            autostart: false,
          },
        }),
        mutateConfigFactory,
      ],
    })
    runningAgents.push(agent)

    agent.trigger({ type: SERVER_FACTORY_EVENTS.server_start })
    await Bun.sleep(50)

    const updatedConfig = ServerFactoryConfigSchema.parse({
      ...configSignal.get(),
      routes: {
        '/health': new Response('UPDATED'),
      },
    })
    configSignal.set?.(updatedConfig)
    agent.trigger({ type: SERVER_FACTORY_EVENTS.server_reload })

    await Bun.sleep(50)

    const runningPort = statusSignal.get()?.port ?? 0
    expect(runningPort).toBeGreaterThan(0)
    const response = await fetch(`http://localhost:${runningPort}/health`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('UPDATED')
  })
})
