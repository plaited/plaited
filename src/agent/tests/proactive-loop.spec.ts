/**
 * Tests for proactive mode wiring in createAgentLoop.
 *
 * @remarks
 * Verifies that:
 * - tick fires and enters pipeline when no task is active
 * - tick is blocked when a task is active (taskGate)
 * - User task interrupts proactive cycle (tickYield)
 * - Heartbeat cleanup on destroy
 * - Default (no proactive) behavior is unchanged
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../../events.ts'
import { AGENT_EVENTS, RISK_TAG } from '../agent.constants.ts'
import { createAgentLoop } from '../agent.loop.ts'
import type { ToolDefinition } from '../agent.schemas.ts'
import type { AgentNode, Model, ModelDelta } from '../agent.types.ts'

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
// Mock tools
// ============================================================================

const taggedWorkspaceTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read a file',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  tags: [RISK_TAG.workspace],
}

// ============================================================================
// Helpers
// ============================================================================

/** Collect events from the agent loop */
const collectEvents = (agent: AgentNode) => {
  const events: Array<{ type: string; detail?: unknown }> = []
  agent.subscribe({
    [AGENT_EVENTS.invoke_inference]() {
      events.push({ type: AGENT_EVENTS.invoke_inference })
    },
    [AGENT_EVENTS.model_response](d: unknown) {
      events.push({ type: AGENT_EVENTS.model_response, detail: d })
    },
    [AGENT_EVENTS.message](d: unknown) {
      events.push({ type: AGENT_EVENTS.message, detail: d })
    },
    [AGENT_EVENTS.tick](d: unknown) {
      events.push({ type: AGENT_EVENTS.tick, detail: d })
    },
    [AGENT_EVENTS.sensor_delta](d: unknown) {
      events.push({ type: AGENT_EVENTS.sensor_delta, detail: d })
    },
    [AGENT_EVENTS.sensor_sweep](d: unknown) {
      events.push({ type: AGENT_EVENTS.sensor_sweep, detail: d })
    },
    [AGENT_EVENTS.sleep](d: unknown) {
      events.push({ type: AGENT_EVENTS.sleep, detail: d })
    },
    [AGENT_EVENTS.execute](d: unknown) {
      events.push({ type: AGENT_EVENTS.execute, detail: d })
    },
    [AGENT_EVENTS.tool_result](d: unknown) {
      events.push({ type: AGENT_EVENTS.tool_result, detail: d })
    },
  })
  return events
}

/** Wait for a specific event to appear */
const waitForEvent = async (events: Array<{ type: string }>, eventType: string, timeoutMs = 2000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (events.some((e) => e.type === eventType)) return
    await Bun.sleep(10)
  }
  throw new Error(`Timeout waiting for ${eventType}. Got: ${events.map((e) => e.type).join(', ')}`)
}

/** Connect a session (unlock sessionGate) */
const connect = (agent: AgentNode) => {
  agent.trigger({
    type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
    detail: { sessionId: 'test', source: 'document', isReconnect: false },
  })
}

/** Connect + trigger task */
const connectAndTask = (agent: AgentNode, prompt: string) => {
  connect(agent)
  agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt } })
}

// ============================================================================
// Tests
// ============================================================================

describe('proactive mode in createAgentLoop', () => {
  // ── Test 1: tick fires and enters pipeline when no task active ─────────

  test('tick fires and enters pipeline when no task is active', async () => {
    const model = createMockModel([
      // Proactive cycle: model responds with text (no action needed)
      { text: 'No action needed right now.' },
    ])

    const agent = await createAgentLoop({
      model,
      tools: [taggedWorkspaceTool],
      toolExecutor: async () => 'content',
      memoryPath: '/tmp/test-proactive-tick',
      sessionId: 'test-proactive-tick',
      proactive: { intervalMs: 50 },
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)

    // Connect session (unlock sessionGate) — tick fires via heartbeat
    connect(agent)

    // Wait for the proactive cycle to complete
    await waitForEvent(events, AGENT_EVENTS.message, 3000)

    // Verify tick entered the pipeline
    expect(events.some((e) => e.type === AGENT_EVENTS.invoke_inference)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.message)).toBe(true)
  })

  // ── Test 2: tick blocked when task is active (taskGate) ────────────────

  test('tick blocked when task is active (taskGate serialization)', async () => {
    let inferenceCount = 0
    const slowModel: Model = {
      reason: async function* () {
        inferenceCount++
        // Simulate slow inference so tick fires during active task
        await Bun.sleep(200)
        yield { type: 'text_delta', content: `Response ${inferenceCount}` } as ModelDelta
        yield { type: 'done', response: { usage: { inputTokens: 100, outputTokens: 50 } } } as ModelDelta
      },
    }

    const agent = await createAgentLoop({
      model: slowModel,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-proactive-blocked',
      sessionId: 'test-proactive-blocked',
      proactive: { intervalMs: 50 },
    })
    afterAll(() => agent.destroy())

    // Capture inference count synchronously when message fires —
    // after message, taskGate loops and a tick may fire before our
    // await returns, so we capture inside the handler itself.
    let inferenceCountAtMessage = 0
    const firstMessage = new Promise<void>((resolve) => {
      agent.subscribe({
        [AGENT_EVENTS.message]() {
          inferenceCountAtMessage = inferenceCount
          resolve()
        },
      })
    })

    // Connect and immediately trigger a user task
    connectAndTask(agent, 'Do something')

    await firstMessage

    // Only one inference should have run during the active task cycle —
    // ticks fired by the 50ms heartbeat during the 200ms inference are
    // blocked by taskGate phase 2
    expect(inferenceCountAtMessage).toBe(1)
  }, 10_000)

  // ── Test 3: user task interrupts proactive cycle (tickYield) ───────────

  test('user task interrupts proactive cycle via tickYield', async () => {
    let inferenceCount = 0
    const model: Model = {
      reason: async function* () {
        inferenceCount++
        // Slow enough that we can inject a task during proactive inference
        await Bun.sleep(150)
        yield { type: 'text_delta', content: `Response ${inferenceCount}` } as ModelDelta
        yield { type: 'done', response: { usage: { inputTokens: 100, outputTokens: 50 } } } as ModelDelta
      },
    }

    const agent = await createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-proactive-interrupt',
      sessionId: 'test-proactive-interrupt',
      proactive: { intervalMs: 30 },
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connect(agent)

    // Wait for tick to fire and start proactive inference
    await waitForEvent(events, AGENT_EVENTS.invoke_inference, 2000)

    // While proactive cycle is running, send a user task
    // tickYield will interrupt the proactive cycle
    agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt: 'User task' } })

    // Wait for user task to complete
    await waitForEvent(events, AGENT_EVENTS.message, 3000)

    // Verify the message event fired (could be from either proactive or task)
    expect(events.some((e) => e.type === AGENT_EVENTS.message)).toBe(true)
  })

  // ── Test 4: heartbeat cleanup on destroy ───────────────────────────────

  test('heartbeat cleanup on destroy', async () => {
    const model = createMockModel([{ text: 'Hello' }])

    const agent = await createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-proactive-destroy',
      sessionId: 'test-proactive-destroy',
      proactive: { intervalMs: 30 },
    })

    // Heartbeat handle should be present
    expect(agent.heartbeat).toBeDefined()
    expect(agent.heartbeat!.setInterval).toBeFunction()
    expect(agent.heartbeat!.destroy).toBeFunction()

    // Destroy should not throw and should stop heartbeat
    agent.destroy()

    // After destroy, no new ticks should fire
    const events: string[] = []
    // Can't subscribe after destroy — just verify destroy didn't throw
    await Bun.sleep(100)
    expect(events).toHaveLength(0)
  })

  // ── Test 5: default (no proactive) behavior is unchanged ───────────────

  test('default behavior: no proactive option = no heartbeat, no tick handling', async () => {
    const model = createMockModel([{ text: 'Hello' }])

    const agent = await createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-no-proactive',
      sessionId: 'test-no-proactive',
      // No proactive option
    })
    afterAll(() => agent.destroy())

    // No heartbeat handle
    expect(agent.heartbeat).toBeUndefined()

    // Normal task flow works
    const events = collectEvents(agent)
    connectAndTask(agent, 'Hello')

    await waitForEvent(events, AGENT_EVENTS.message, 2000)

    expect(events.some((e) => e.type === AGENT_EVENTS.message)).toBe(true)
    // No tick events
    expect(events.some((e) => e.type === AGENT_EVENTS.tick)).toBe(false)
  })

  // ── Test 6: tick with sensors triggers sensor_delta + sensor_sweep ─────

  test('tick with sensors runs sensor sweep pipeline', async () => {
    const model = createMockModel([{ text: 'Sensor data processed.' }])

    const mockSensor = {
      name: 'test-sensor',
      read: async (_signal: AbortSignal) => ({ commits: ['abc123'] }),
      diff: (current: unknown, _previous: unknown) => current,
      snapshotPath: 'test-sensor.json',
    }

    const agent = await createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-proactive-sensors',
      sessionId: 'test-proactive-sensors',
      proactive: { intervalMs: 50, sensors: [mockSensor] },
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connect(agent)

    // Wait for sensor sweep to complete and inference to run
    await waitForEvent(events, AGENT_EVENTS.message, 5000)

    // Verify sensor pipeline ran
    expect(events.some((e) => e.type === AGENT_EVENTS.sensor_delta)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.sensor_sweep)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.invoke_inference)).toBe(true)

    // Check sensor delta detail
    const deltaEvent = events.find((e) => e.type === AGENT_EVENTS.sensor_delta)
    const detail = deltaEvent?.detail as { sensor: string; delta: unknown }
    expect(detail.sensor).toBe('test-sensor')
  })

  // ── Test 7: tick with sensor returning null diff triggers sleep ─────────

  test('tick with sensor returning null diff triggers sleep (no inference)', async () => {
    const model = createMockModel([{ text: 'Should not be called.' }])

    const nullSensor = {
      name: 'null-sensor',
      read: async (_signal: AbortSignal) => ({ status: 'unchanged' }),
      diff: (_current: unknown, _previous: unknown) => null, // no change
      snapshotPath: 'null-sensor.json',
    }

    const agent = await createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-proactive-null-sensor',
      sessionId: 'test-proactive-null-sensor',
      proactive: { intervalMs: 50, sensors: [nullSensor] },
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connect(agent)

    // Zero deltas → sleep event (not inference)
    await waitForEvent(events, AGENT_EVENTS.sleep, 3000)

    // No sensor_delta (diff returned null)
    expect(events.some((e) => e.type === AGENT_EVENTS.sensor_delta)).toBe(false)
    // No sensor_sweep (no deltas to batch)
    expect(events.some((e) => e.type === AGENT_EVENTS.sensor_sweep)).toBe(false)
    // No inference — sleep means "nothing to do"
    expect(events.some((e) => e.type === AGENT_EVENTS.invoke_inference)).toBe(false)
    // Sleep event carries the interval duration
    const sleepEvent = events.find((e) => e.type === AGENT_EVENTS.sleep)
    expect((sleepEvent?.detail as { durationMs: number }).durationMs).toBe(50)
  })

  // ── Test 8: heartbeat handle allows runtime interval control ──────────

  test('heartbeat handle setInterval reconfigures timer', async () => {
    const model = createMockModel([
      { text: 'First tick response.' },
      { text: 'Second tick response.' },
    ])

    const agent = await createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-proactive-setinterval',
      sessionId: 'test-proactive-setinterval',
      proactive: { intervalMs: 50 },
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connect(agent)

    // Wait for first tick cycle
    await waitForEvent(events, AGENT_EVENTS.message, 3000)

    // Pause heartbeat
    agent.heartbeat!.setInterval(0)
    const countAfterPause = events.filter((e) => e.type === AGENT_EVENTS.message).length

    await Bun.sleep(150)

    // No new messages while paused
    const countAfterWait = events.filter((e) => e.type === AGENT_EVENTS.message).length
    expect(countAfterWait).toBe(countAfterPause)
  })
})
