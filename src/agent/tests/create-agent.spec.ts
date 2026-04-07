import { describe, expect, test } from 'bun:test'
import { AGENT_EVENTS } from '../agent.constants.ts'
import { createAgent } from '../create-agent.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createAgent', () => {
  test('returns public trigger/useSnapshot handle and installs module handlers', async () => {
    const seen: string[] = []
    const agent = await createAgent({
      id: 'agent:test',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        () => ({
          handlers: {
            custom_event() {
              seen.push('custom_event')
            },
          },
        }),
      ],
    })

    agent.trigger({ type: 'custom_event' })

    expect(seen).toEqual(['custom_event'])
    expect(typeof agent.trigger).toBe('function')
    expect(typeof agent.useSnapshot).toBe('function')
  })

  test('module params remove trigger/signals/computed and provide emit/contextMemory', async () => {
    let hasModuleId = false
    let hasTrigger = false
    let hasSignals = false
    let hasComputed = false
    let hasEmit = false
    let hasContextMemory = false

    await createAgent({
      id: 'agent:params',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        (params) => {
          hasTrigger = Reflect.has(params as object, 'trigger')
          hasSignals = Reflect.has(params as object, 'signals')
          hasComputed = Reflect.has(params as object, 'computed')
          hasEmit = Reflect.has(params as object, 'emit')
          hasContextMemory = Reflect.has(params as object, 'contextMemory')
          hasModuleId = Reflect.has(params as object, 'moduleId')
          return {}
        },
      ],
    })

    expect(hasTrigger).toBe(false)
    expect(hasSignals).toBe(false)
    expect(hasComputed).toBe(false)
    expect(hasEmit).toBe(true)
    expect(hasContextMemory).toBe(true)
    expect(hasModuleId).toBe(true)
  })

  test('module emit drives behavior and is distinguished from host trigger by source provenance', async () => {
    const seen: string[] = []

    const agent = await createAgent({
      id: 'agent:emit',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ emit }) => ({
          handlers: {
            kick() {
              emit({ type: 'module_event', detail: { from: 'module' } })
            },
            module_event() {
              seen.push('module_event')
            },
          },
        }),
      ],
    })

    agent.trigger({ type: 'kick' })

    expect(seen).toEqual(['module_event'])
  })

  test('context memory stores last detail by moduleId:eventType and exposes getters', async () => {
    let getLastBy!: (moduleId: string, eventType: string) => unknown
    let getLast!: (key: string) => unknown
    let moduleId = ''

    const agent = await createAgent({
      id: 'agent:context-memory',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ moduleId: id, emit, contextMemory }) => {
          moduleId = id
          getLastBy = contextMemory.getLastBy
          getLast = contextMemory.getLast
          return {
            handlers: {
              run_emit_sequence() {
                emit({ type: 'memory_evt', detail: { n: 1 } })
                emit({ type: 'memory_evt', detail: { n: 2 } })
              },
            },
          }
        },
      ],
    })

    agent.trigger({ type: 'run_emit_sequence' })

    expect(getLastBy(moduleId, 'memory_evt')).toEqual({ n: 2 })
    expect(getLast(`${moduleId}:memory_evt`)).toEqual({ n: 2 })
  })

  test('context memory evicts expired keys with TTL policy', async () => {
    let getLastBy!: (moduleId: string, eventType: string) => unknown
    let moduleId = ''

    const agent = await createAgent({
      id: 'agent:context-memory-ttl',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      contextMemory: {
        ttlMs: 20,
      },
      modules: [
        ({ moduleId: id, emit, contextMemory }) => {
          moduleId = id
          getLastBy = contextMemory.getLastBy
          return {
            handlers: {
              run_emit_once() {
                emit({ type: 'memory_evt_ttl', detail: { active: true } })
              },
            },
          }
        },
      ],
    })

    agent.trigger({ type: 'run_emit_once' })

    expect(getLastBy(moduleId, 'memory_evt_ttl')).toEqual({ active: true })
    await Bun.sleep(35)
    expect(getLastBy(moduleId, 'memory_evt_ttl')).toBeUndefined()

    agent.trigger({ type: AGENT_EVENTS.agent_disconnect })
  })

  test('installs runtime modules through update_modules using emit API', async () => {
    const seen: string[] = []
    const modulePath = './src/agent/tests/fixtures/update-modules.fixture.ts'
    let resolvePong!: () => void
    const pongSeen = new Promise<void>((resolve) => {
      resolvePong = resolve
    })

    const agent = await createAgent({
      id: 'agent:update-modules',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        () => ({
          handlers: {
            fixture_pong() {
              seen.push('fixture_pong')
              resolvePong()
            },
          },
        }),
      ],
    })

    agent.trigger({
      type: AGENT_EVENTS.update_modules,
      detail: modulePath,
    })

    for (let attempt = 0; attempt < 10 && seen.length === 0; attempt++) {
      await Bun.sleep(10)
      agent.trigger({ type: 'fixture_ping' })
    }

    await pongSeen
    expect(seen).toEqual(['fixture_pong'])
  })
})
