/**
 * Tests for set_heartbeat tool + proactive context contributor.
 *
 * @remarks
 * Verifies:
 * - set_heartbeat tool changes interval via HeartbeatHandle
 * - set_heartbeat with 0 pauses the heartbeat
 * - Proactive contributor only contributes during tick cycles
 * - Proactive contributor returns null during task cycles
 * - Proactive contributor includes sensor deltas when present
 * - set_heartbeat wired into createAgentLoop execute handler
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../../events.ts'
import { AGENT_EVENTS, RISK_TAG } from '../agent.constants.ts'
import { createProactiveContextContributor } from '../context.ts'
import { createAgentLoop } from '../create-agent-loop.ts'
import type { ToolDefinition } from '../agent.schemas.ts'
import type { AgentNode, Model, ModelDelta, SensorDeltaDetail } from '../agent.types.ts'
import { createSetHeartbeatHandler } from '../../tools/crud.ts'
import { BUILT_IN_RISK_TAGS } from '../../tools/crud.ts'
import type { HeartbeatHandle } from '../proactive.ts'

// ============================================================================
// Mock Model
// ============================================================================

const createMockModel = (
  responses: Array<{ toolCalls?: Array<{ id: string; name: string; arguments: string }>; text?: string }>,
): Model => {
  let callCount = 0
  return {
    reason: async function* () {
      const response = responses[callCount] ?? responses[responses.length - 1]!
      callCount++

      if (response.text) {
        yield { type: 'text_delta', content: response.text } as ModelDelta
      }

      if (response.toolCalls) {
        for (const tc of response.toolCalls) {
          yield { type: 'toolcall_delta', id: tc.id, name: tc.name, arguments: tc.arguments } as ModelDelta
        }
      }

      yield {
        type: 'done',
        response: { usage: { inputTokens: 100, outputTokens: 50 } },
      } as ModelDelta
    },
  }
}

// ============================================================================
// Helpers
// ============================================================================

const connect = (agent: AgentNode) => {
  agent.trigger({
    type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
    detail: { sessionId: 'test', source: 'document', isReconnect: false },
  })
}

const waitForEvent = async (events: Array<{ type: string }>, eventType: string, timeoutMs = 2000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (events.some((e) => e.type === eventType)) return
    await Bun.sleep(10)
  }
  throw new Error(`Timeout waiting for ${eventType}. Got: ${events.map((e) => e.type).join(', ')}`)
}

const collectEvents = (agent: AgentNode) => {
  const events: Array<{ type: string; detail?: unknown }> = []
  agent.subscribe({
    [AGENT_EVENTS.invoke_inference]() {
      events.push({ type: AGENT_EVENTS.invoke_inference })
    },
    [AGENT_EVENTS.message](d: unknown) {
      events.push({ type: AGENT_EVENTS.message, detail: d })
    },
    [AGENT_EVENTS.execute](d: unknown) {
      events.push({ type: AGENT_EVENTS.execute, detail: d })
    },
    [AGENT_EVENTS.tool_result](d: unknown) {
      events.push({ type: AGENT_EVENTS.tool_result, detail: d })
    },
    [AGENT_EVENTS.tick](d: unknown) {
      events.push({ type: AGENT_EVENTS.tick, detail: d })
    },
  })
  return events
}

// ============================================================================
// Unit tests: createSetHeartbeatHandler
// ============================================================================

describe('createSetHeartbeatHandler', () => {
  test('changes interval and returns active status', async () => {
    let lastIntervalMs = 0
    const mockHandle: HeartbeatHandle = {
      setInterval: (ms: number) => {
        lastIntervalMs = ms
      },
      destroy: () => {},
    }

    const handler = createSetHeartbeatHandler(mockHandle)
    const result = (await handler({ interval_seconds: 120 }, { workspace: '', signal: AbortSignal.timeout(5000) })) as {
      interval_seconds: number
      status: string
    }

    expect(result.interval_seconds).toBe(120)
    expect(result.status).toBe('active')
    expect(lastIntervalMs).toBe(120_000) // 120 seconds → 120000 ms
  })

  test('pauses when interval_seconds is 0', async () => {
    let lastIntervalMs = -1
    const mockHandle: HeartbeatHandle = {
      setInterval: (ms: number) => {
        lastIntervalMs = ms
      },
      destroy: () => {},
    }

    const handler = createSetHeartbeatHandler(mockHandle)
    const result = (await handler({ interval_seconds: 0 }, { workspace: '', signal: AbortSignal.timeout(5000) })) as {
      interval_seconds: number
      status: string
    }

    expect(result.interval_seconds).toBe(0)
    expect(result.status).toBe('paused')
    expect(lastIntervalMs).toBe(0) // 0 ms → pause
  })
})

// ============================================================================
// Unit tests: BUILT_IN_RISK_TAGS
// ============================================================================

describe('set_heartbeat risk tags', () => {
  test('set_heartbeat tagged as workspace (safe, skip simulation)', () => {
    expect(BUILT_IN_RISK_TAGS.set_heartbeat).toEqual([RISK_TAG.workspace])
  })
})

// ============================================================================
// Unit tests: createProactiveContextContributor
// ============================================================================

describe('createProactiveContextContributor', () => {
  const defaultState = {
    history: [],
    activeTools: [],
    constitution: [],
    priorRejections: [],
  }

  test('returns null during reactive (task) cycles', () => {
    const contributor = createProactiveContextContributor()
    // Default is not proactive
    const segment = contributor.contribute(defaultState)
    expect(segment).toBeNull()
  })

  test('returns null after setProactive(false)', () => {
    const contributor = createProactiveContextContributor()
    contributor.setProactive(true)
    contributor.setProactive(false)
    const segment = contributor.contribute(defaultState)
    expect(segment).toBeNull()
  })

  test('returns context segment during proactive cycles', () => {
    const contributor = createProactiveContextContributor()
    contributor.setProactive(true)

    const segment = contributor.contribute(defaultState)
    expect(segment).not.toBeNull()
    expect(segment!.role).toBe('system')
    expect(segment!.content).toContain('Proactive Check')
    expect(segment!.content).toContain('periodic heartbeat')
    expect(segment!.content).toContain('is any action required')
  })

  test('has priority 90', () => {
    const contributor = createProactiveContextContributor()
    expect(contributor.priority).toBe(90)
  })

  test('has name proactive_context', () => {
    const contributor = createProactiveContextContributor()
    expect(contributor.name).toBe('proactive_context')
  })

  test('includes sensor deltas when present', () => {
    const contributor = createProactiveContextContributor()
    contributor.setProactive(true)

    const deltas: SensorDeltaDetail[] = [
      { sensor: 'git', delta: { newCommits: ['abc123'] } },
      { sensor: 'fs', delta: { newFiles: ['readme.md'] } },
    ]
    contributor.setSensorDeltas(deltas)

    const segment = contributor.contribute(defaultState)
    expect(segment).not.toBeNull()
    expect(segment!.content).toContain('Sensor Deltas')
    expect(segment!.content).toContain('git')
    expect(segment!.content).toContain('abc123')
    expect(segment!.content).toContain('fs')
    expect(segment!.content).toContain('readme.md')
  })

  test('shows no-change message when deltas are empty', () => {
    const contributor = createProactiveContextContributor()
    contributor.setProactive(true)
    contributor.setSensorDeltas([])

    const segment = contributor.contribute(defaultState)
    expect(segment).not.toBeNull()
    expect(segment!.content).toContain('No sensor changes detected')
  })

  test('has positive token estimate', () => {
    const contributor = createProactiveContextContributor()
    contributor.setProactive(true)

    const segment = contributor.contribute(defaultState)
    expect(segment!.tokenEstimate).toBeGreaterThan(0)
  })
})

// ============================================================================
// Integration tests: set_heartbeat wired into createAgentLoop
// ============================================================================

describe('set_heartbeat in createAgentLoop', () => {
  const setHeartbeatTool: ToolDefinition = {
    type: 'function',
    function: {
      name: 'set_heartbeat',
      description: 'Set heartbeat interval',
      parameters: {
        type: 'object',
        properties: { interval_seconds: { type: 'number' } },
        required: ['interval_seconds'],
      },
    },
    tags: [RISK_TAG.workspace],
  }

  test('set_heartbeat tool call changes heartbeat interval', async () => {
    // Model calls set_heartbeat to pause, then responds with text
    const model = createMockModel([
      {
        toolCalls: [
          { id: 'tc-1', name: 'set_heartbeat', arguments: '{"interval_seconds": 0}' },
        ],
      },
      { text: 'Heartbeat paused.' },
    ])

    const agent = await createAgentLoop({
      model,
      tools: [setHeartbeatTool],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-set-heartbeat-integration',
      sessionId: 'test-set-heartbeat-integration',
      proactive: { intervalMs: 60_000 },
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)

    // Connect and trigger a task that calls set_heartbeat
    connect(agent)
    agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt: 'Pause the heartbeat' } })

    await waitForEvent(events, AGENT_EVENTS.message, 3000)

    // Verify set_heartbeat was executed (tool_result fired)
    expect(events.some((e) => e.type === AGENT_EVENTS.execute)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.tool_result)).toBe(true)

    // Heartbeat should now be paused — wait and verify no ticks fire
    const ticksBefore = events.filter((e) => e.type === AGENT_EVENTS.tick).length
    await Bun.sleep(200)
    const ticksAfter = events.filter((e) => e.type === AGENT_EVENTS.tick).length
    expect(ticksAfter).toBe(ticksBefore)
  })

  test('proactive context framing is included during tick cycles', async () => {
    // Capture assembled context messages to verify proactive framing
    let capturedMessages: Array<{ role: string; content?: string | null }> = []

    const inspectingModel: Model = {
      reason: async function* (args) {
        // Capture the messages passed to inference
        capturedMessages = args.messages as Array<{ role: string; content?: string | null }>
        yield { type: 'text_delta', content: 'No action needed.' } as ModelDelta
        yield { type: 'done', response: { usage: { inputTokens: 100, outputTokens: 50 } } } as ModelDelta
      },
    }

    const agent = await createAgentLoop({
      model: inspectingModel,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-proactive-framing',
      sessionId: 'test-proactive-framing',
      proactive: { intervalMs: 50 },
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connect(agent)

    // Wait for proactive cycle to complete (tick → inference → message)
    await waitForEvent(events, AGENT_EVENTS.message, 3000)

    // The context should include proactive framing
    const proactiveSegment = capturedMessages.find(
      (m) => m.role === 'system' && m.content?.includes('Proactive Check'),
    )
    expect(proactiveSegment).toBeDefined()
    expect(proactiveSegment!.content).toContain('periodic heartbeat')
  })

  test('proactive context framing is NOT included during task cycles', async () => {
    let capturedMessages: Array<{ role: string; content?: string | null }> = []

    const inspectingModel: Model = {
      reason: async function* (args) {
        capturedMessages = args.messages as Array<{ role: string; content?: string | null }>
        yield { type: 'text_delta', content: 'Done.' } as ModelDelta
        yield { type: 'done', response: { usage: { inputTokens: 100, outputTokens: 50 } } } as ModelDelta
      },
    }

    const agent = await createAgentLoop({
      model: inspectingModel,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-task-no-proactive-framing',
      sessionId: 'test-task-no-proactive-framing',
      // Proactive enabled — but task should NOT get proactive framing
      proactive: { intervalMs: 60_000 }, // long interval so no tick fires first
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)

    // Connect and immediately trigger a user task
    connect(agent)
    agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt: 'Hello' } })

    await waitForEvent(events, AGENT_EVENTS.message, 3000)

    // No proactive framing in task cycle
    const proactiveSegment = capturedMessages.find(
      (m) => m.role === 'system' && m.content?.includes('Proactive Check'),
    )
    expect(proactiveSegment).toBeUndefined()
  })
})
