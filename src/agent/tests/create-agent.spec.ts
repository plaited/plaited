import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import type { BPListener } from '../../behavioral/behavioral.types.ts'
import { bSync, bThread } from '../../behavioral.ts'
import { AGENT_EVENTS } from '../agent.constants.ts'
import { createAgent } from '../create-agent.ts'
import { useModule } from '../use-module.ts'

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

  test('module params remove trigger/signals/computed and provide emit/last/addThreads', async () => {
    let hasModuleId = false
    let hasTrigger = false
    let hasSignals = false
    let hasComputed = false
    let hasEmit = false
    let hasLast = false
    let hasAddThreads = false

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
          hasLast = Reflect.has(params as object, 'last')
          hasAddThreads = Reflect.has(params as object, 'addThreads')
          hasModuleId = Reflect.has(params as object, 'moduleId')
          return {}
        },
      ],
    })

    expect(hasTrigger).toBe(false)
    expect(hasSignals).toBe(false)
    expect(hasComputed).toBe(false)
    expect(hasEmit).toBe(true)
    expect(hasLast).toBe(true)
    expect(hasAddThreads).toBe(true)
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

  test('context memory stores selected events and resolves them through last(listener)', async () => {
    let getMemory!: (listener: BPListener) => unknown
    const listener = {
      type: 'memory_evt',
      sourceSchema: z.literal('emit'),
      detailSchema: z.object({ n: z.number() }),
    }

    const agent = await createAgent({
      id: 'agent:context-memory',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ emit, last }) => {
          getMemory = last
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

    expect(getMemory(listener)).toEqual({ n: 2 })
  })

  test('context memory evicts expired keys with TTL policy', async () => {
    let getMemory!: (listener: BPListener) => unknown
    const listener = {
      type: 'memory_evt_ttl',
      sourceSchema: z.literal('emit'),
      detailSchema: z.object({ active: z.boolean() }),
    }

    const agent = await createAgent({
      id: 'agent:context-memory-ttl',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      contextMemory: {
        ttlMs: 20,
      },
      modules: [
        ({ emit, last }) => {
          getMemory = last
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

    expect(getMemory(listener)).toEqual({ active: true })
    await Bun.sleep(35)
    expect(getMemory(listener)).toBeUndefined()

    agent.trigger({ type: AGENT_EVENTS.agent_disconnect })
  })

  test('context memory records selected events only, not blocked emit attempts', async () => {
    let getMemory!: (listener: BPListener) => unknown
    const blockedListener = {
      type: 'memory_evt_blocked',
      sourceSchema: z.literal('emit'),
      detailSchema: z.object({ blocked: z.literal(true) }),
    }
    const selectedListener = {
      type: 'memory_evt_selected',
      sourceSchema: z.literal('emit'),
      detailSchema: z.object({ selected: z.literal(true) }),
    }

    const agent = await createAgent({
      id: 'agent:context-memory-selected-only',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ emit, last }) => {
          getMemory = last
          return {
            threads: {
              blocker: bThread(
                [
                  bSync({
                    block: {
                      type: 'memory_evt_blocked',
                      sourceSchema: z.literal('emit'),
                      detailSchema: z.object({ blocked: z.literal(true) }),
                    },
                  }),
                ],
                true,
              ),
            },
            handlers: {
              run_emit_with_blocked_attempt() {
                emit({ type: 'memory_evt_blocked', detail: { blocked: true } })
                emit({ type: 'memory_evt_selected', detail: { selected: true } })
              },
            },
          }
        },
      ],
    })

    agent.trigger({ type: 'run_emit_with_blocked_attempt' })

    expect(getMemory(blockedListener)).toBeUndefined()
    expect(getMemory(selectedListener)).toEqual({ selected: true })
  })

  test('context memory records the exact selected candidate when multiple bids share a type', async () => {
    let getMemory!: (listener: BPListener) => unknown
    const listener = {
      type: 'same_type',
      sourceSchema: z.literal('request'),
      detailSchema: z.object({ n: z.number() }),
    }

    const agent = await createAgent({
      id: 'agent:context-memory-exact-selected-candidate',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ last }) => {
          getMemory = last
          return {
            threads: {
              blockSecond: bThread(
                [
                  bSync({
                    block: {
                      type: 'same_type',
                      sourceSchema: z.literal('request'),
                      detailSchema: z.object({ n: z.literal(2) }),
                    },
                  }),
                ],
                true,
              ),
              first: bThread([bSync({ request: { type: 'same_type', detail: { n: 1 } } })]),
              second: bThread([bSync({ request: { type: 'same_type', detail: { n: 2 } } })]),
            },
          }
        },
      ],
    })

    agent.trigger({ type: 'kickoff' })
    expect(getMemory(listener)).toEqual({ n: 1 })
  })

  test('scopes returned module threads using the declared module name in snapshots', async () => {
    const KickoffEventSchema = z.object({
      type: z.literal('kickoff'),
      detail: z.undefined(),
    })
    const PlannerReadyEventSchema = z.object({
      type: z.literal('planner_ready'),
      detail: z.undefined(),
    })
    const planner = useModule('planner', ({ external, bSync, bThread }) => {
      const kickoff = external(KickoffEventSchema)
      const plannerReady = external(PlannerReadyEventSchema)
      return {
        threads: {
          guard: bThread([
            bSync({
              waitFor: kickoff.on(z.literal('trigger')),
            }),
            bSync({
              request: plannerReady.request(),
            }),
          ]),
        },
      }
    })

    const agent = await createAgent({
      id: 'agent:scoped-static-thread-labels',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [planner],
    })

    let resolveSelection!: () => void
    const selectionSeen = new Promise<void>((resolve) => {
      resolveSelection = resolve
    })
    const selectedLabels: string[] = []

    agent.useSnapshot((message) => {
      if (message.kind !== 'selection') {
        return
      }
      const selectedBid = message.bids.find((bid) => bid.selected && bid.type === 'planner_ready')
      if (!selectedBid) {
        return
      }
      selectedLabels.push(selectedBid.thread.label)
      resolveSelection()
    })

    agent.trigger({ type: 'kickoff' })

    await selectionSeen
    expect(selectedLabels).toEqual(['planner:guard'])
  })

  test('scopes handler-added dynamic threads using the declared module name in snapshots', async () => {
    const DynamicReadyEventSchema = z.object({
      type: z.literal('dynamic_ready'),
      detail: z.undefined(),
    })
    const planner = useModule('planner', ({ addThreads, external, bSync, bThread }) => {
      const dynamicReady = external(DynamicReadyEventSchema)
      return {
        handlers: {
          kickoff() {
            addThreads({
              taskGuard: bThread([
                bSync({
                  request: dynamicReady.request(),
                }),
              ]),
            })
          },
        },
      }
    })

    const agent = await createAgent({
      id: 'agent:scoped-dynamic-thread-labels',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [planner],
    })

    let resolveSelection!: () => void
    const selectionSeen = new Promise<void>((resolve) => {
      resolveSelection = resolve
    })
    const selectedLabels: string[] = []

    agent.useSnapshot((message) => {
      if (message.kind !== 'selection') {
        return
      }
      const selectedBid = message.bids.find((bid) => bid.selected && bid.type === 'dynamic_ready')
      if (!selectedBid) {
        return
      }
      selectedLabels.push(selectedBid.thread.label)
      resolveSelection()
    })

    agent.trigger({ type: 'planner:kickoff' })

    await selectionSeen
    expect(selectedLabels).toEqual(['planner:taskGuard'])
  })

  test('throws during bootstrap install when module bSync request bypasses event refs', async () => {
    const invalidModule = useModule('planner', ({ bSync, bThread }) => ({
      threads: {
        guard: bThread([
          bSync({
            request: {
              type: 'raw',
            },
          }),
        ]),
      },
    }))

    await expect(
      createAgent({
        id: 'agent:invalid-use-module-bsync-request',
        cwd: process.cwd(),
        workspace: process.cwd(),
        models: TEST_MODELS,
        modules: [invalidModule],
      }),
    ).rejects.toThrow(
      /request.*local\(schema\)\.request\(\.\.\.\) or external\(schema\[, moduleName\]\)\.request\(\.\.\.\)/,
    )
  })

  test('throws during bootstrap install when module returns threads built from canonical imported helpers', async () => {
    const PlannerReadyEventSchema = z.object({
      type: z.literal('planner_ready'),
      detail: z.undefined(),
    })
    const invalidModule = useModule('planner', ({ external }) => {
      const plannerReady = external(PlannerReadyEventSchema)
      return {
        threads: {
          guard: bThread([bSync({ request: plannerReady.request() })]),
        },
      }
    })

    await expect(
      createAgent({
        id: 'agent:invalid-use-module-canonical-thread',
        cwd: process.cwd(),
        workspace: process.cwd(),
        models: TEST_MODELS,
        modules: [invalidModule],
      }),
    ).rejects.toThrow(/return threads\["guard"\].*bSync and bThread helpers from useModule callback args/)
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

  test('reports module_warning snapshot when runtime module result parsing fails', async () => {
    const modulePath = './src/agent/tests/fixtures/update-modules-invalid.fixture.ts'
    let resolveWarning!: () => void
    const warningSeen = new Promise<void>((resolve) => {
      resolveWarning = resolve
    })

    const agent = await createAgent({
      id: 'agent:update-modules-invalid',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
    })

    const warnings: Array<{ moduleId: string; lane?: string; code?: string; warning: string }> = []
    agent.useSnapshot((message) => {
      if (message.kind !== 'module_warning') {
        return
      }
      warnings.push({
        moduleId: message.moduleId,
        lane: message.lane,
        code: message.code,
        warning: message.warning,
      })
      resolveWarning()
    })

    agent.trigger({
      type: AGENT_EVENTS.update_modules,
      detail: modulePath,
    })

    await warningSeen
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toEqual(
      expect.objectContaining({
        moduleId: `update:${modulePath}#0`,
        lane: `update:${modulePath}`,
        code: 'module_install_parse_error',
      }),
    )
  })

  test('reports module_warning snapshot when a module id repeats across installs in the same lane', async () => {
    const modulePath = './src/agent/tests/fixtures/update-modules.fixture.ts'
    const warnings: Array<{ moduleId: string; lane?: string; code?: string; warning: string }> = []
    let resolveWarning!: () => void
    const warningSeen = new Promise<void>((resolve) => {
      resolveWarning = resolve
    })

    const agent = await createAgent({
      id: 'agent:update-modules-duplicate-id',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
    })

    agent.useSnapshot((message) => {
      if (message.kind !== 'module_warning') {
        return
      }
      warnings.push({
        moduleId: message.moduleId,
        lane: message.lane,
        code: message.code,
        warning: message.warning,
      })
      if (message.code === 'duplicate_module_id') {
        resolveWarning()
      }
    })

    agent.trigger({
      type: AGENT_EVENTS.update_modules,
      detail: modulePath,
    })
    await Bun.sleep(10)
    agent.trigger({
      type: AGENT_EVENTS.update_modules,
      detail: modulePath,
    })

    await warningSeen
    expect(warnings).toContainEqual(
      expect.objectContaining({
        moduleId: `update:${modulePath}#0`,
        lane: `update:${modulePath}`,
        code: 'duplicate_module_id',
      }),
    )
  })

  test('reports duplicate declared module names and skips installing duplicate named modules', async () => {
    const modulePath = './src/agent/tests/fixtures/update-modules-duplicate-name-behavior.fixture.ts'
    const warnings: Array<{ moduleId: string; lane?: string; code?: string; warning: string }> = []
    const seen: string[] = []
    let resolveWarning!: () => void
    const warningSeen = new Promise<void>((resolve) => {
      resolveWarning = resolve
    })
    let resolvePong!: () => void
    const pongSeen = new Promise<void>((resolve) => {
      resolvePong = resolve
    })

    const agent = await createAgent({
      id: 'agent:update-modules-duplicate-name',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        () => ({
          handlers: {
            fixture_pong_first() {
              seen.push('first')
              resolvePong()
            },
            fixture_pong_second() {
              seen.push('second')
            },
          },
        }),
      ],
    })

    agent.useSnapshot((message) => {
      if (message.kind !== 'module_warning') {
        return
      }
      warnings.push({
        moduleId: message.moduleId,
        lane: message.lane,
        code: message.code,
        warning: message.warning,
      })
      if (message.code === 'duplicate_module_name') {
        resolveWarning()
      }
    })

    agent.trigger({
      type: AGENT_EVENTS.update_modules,
      detail: modulePath,
    })
    for (let attempt = 0; attempt < 10 && seen.length === 0; attempt++) {
      await Bun.sleep(10)
      agent.trigger({ type: 'fixture_ping' })
    }

    await warningSeen
    await pongSeen

    expect(seen).toEqual(['first'])
    expect(warnings).toContainEqual(
      expect.objectContaining({
        moduleId: `update:${modulePath}#1`,
        lane: `update:${modulePath}`,
        code: 'duplicate_module_name',
      }),
    )
  })
})
