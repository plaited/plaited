/**
 * Tests for message source tagging and proactive push routing.
 *
 * @remarks
 * Verifies Prompt 13 requirements:
 * - Reactive messages have no source (or source === undefined)
 * - Proactive messages carry source === 'proactive'
 * - createNode routes proactive messages to server.send
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../../events.ts'
import { AGENT_EVENTS, RISK_TAG } from '../agent.constants.ts'
import { createAgentLoop } from '../create-agent-loop.ts'
import type { ToolDefinition } from '../agent.schemas.ts'
import type { AgentNode, MessageDetail, Model, ModelDelta } from '../agent.types.ts'

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

const readFileTool: ToolDefinition = {
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

/** Connect a session (unlock sessionGate) */
const connect = (agent: AgentNode) => {
  agent.trigger({
    type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
    detail: { sessionId: 'test', source: 'document', isReconnect: false },
  })
}

// ============================================================================
// Tests
// ============================================================================

describe('message source tagging', () => {
  // ── Test 1: reactive messages have no source ────────────────────────────

  test('reactive messages from task have no source field', async () => {
    const model = createMockModel([{ text: 'Hello from task.' }])

    const agent = await createAgentLoop({
      model,
      tools: [readFileTool],
      toolExecutor: async () => 'ok',
      memoryPath: '/tmp/test-msg-source-reactive',
      sessionId: 'test-reactive',
    })
    afterAll(() => agent.destroy())

    const messages: MessageDetail[] = []
    agent.subscribe({
      [AGENT_EVENTS.message](detail: unknown) {
        messages.push(detail as MessageDetail)
      },
    })

    connect(agent)
    agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt: 'Say hello' } })

    // Wait for message to appear
    const start = Date.now()
    while (messages.length === 0 && Date.now() - start < 2000) {
      await Bun.sleep(10)
    }

    expect(messages).toHaveLength(1)
    expect(messages[0]!.content).toBe('Hello from task.')
    // Reactive messages should NOT have source set
    expect(messages[0]!.source).toBeUndefined()
  })

  // ── Test 2: proactive messages carry source === 'proactive' ────────────

  test('proactive messages from tick carry source: proactive', async () => {
    const model = createMockModel([{ text: 'Proactive check complete.' }])

    const agent = await createAgentLoop({
      model,
      tools: [readFileTool],
      toolExecutor: async () => 'ok',
      memoryPath: '/tmp/test-msg-source-proactive',
      sessionId: 'test-proactive',
      proactive: { intervalMs: 50 },
    })
    afterAll(() => agent.destroy())

    const messages: MessageDetail[] = []
    agent.subscribe({
      [AGENT_EVENTS.message](detail: unknown) {
        messages.push(detail as MessageDetail)
      },
    })

    // Connect session — tick will fire via heartbeat
    connect(agent)

    // Wait for proactive cycle to complete
    const start = Date.now()
    while (messages.length === 0 && Date.now() - start < 3000) {
      await Bun.sleep(10)
    }

    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages[0]!.content).toBe('Proactive check complete.')
    expect(messages[0]!.source).toBe('proactive')
  })

  // ── Test 3: task after tick resets source to reactive ──────────────────

  test('task after proactive cycle produces reactive message', async () => {
    let callCount = 0
    const model: Model = {
      reason: async function* () {
        callCount++
        if (callCount === 1) {
          // First call (proactive tick) — quick response
          yield { type: 'text_delta', content: 'Proactive response.' } as ModelDelta
        } else {
          // Second call (user task) — different response
          yield { type: 'text_delta', content: 'Task response.' } as ModelDelta
        }
        yield { type: 'done', response: { usage: { inputTokens: 100, outputTokens: 50 } } } as ModelDelta
      },
    }

    const agent = await createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-msg-source-reset',
      sessionId: 'test-reset',
      proactive: { intervalMs: 50 },
    })
    afterAll(() => agent.destroy())

    const messages: MessageDetail[] = []
    agent.subscribe({
      [AGENT_EVENTS.message](detail: unknown) {
        messages.push(detail as MessageDetail)
      },
    })

    connect(agent)

    // Wait for proactive cycle to complete
    const start = Date.now()
    while (messages.length === 0 && Date.now() - start < 3000) {
      await Bun.sleep(10)
    }
    expect(messages[0]!.source).toBe('proactive')

    // Now trigger a user task
    agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt: 'User task' } })

    // Wait for task response
    const start2 = Date.now()
    while (messages.length < 2 && Date.now() - start2 < 3000) {
      await Bun.sleep(10)
    }

    expect(messages).toHaveLength(2)
    expect(messages[1]!.content).toBe('Task response.')
    // User task message should NOT have proactive source
    expect(messages[1]!.source).toBeUndefined()
  })

  // ── Test 4: proactive message with sensors still tagged proactive ──────

  test('proactive message with sensors carries source: proactive', async () => {
    const model = createMockModel([{ text: 'Sensor data reviewed.' }])

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
      memoryPath: '/tmp/test-msg-source-sensors',
      sessionId: 'test-sensors',
      proactive: { intervalMs: 50, sensors: [mockSensor] },
    })
    afterAll(() => agent.destroy())

    const messages: MessageDetail[] = []
    agent.subscribe({
      [AGENT_EVENTS.message](detail: unknown) {
        messages.push(detail as MessageDetail)
      },
    })

    connect(agent)

    // Wait for proactive cycle with sensors to complete
    const start = Date.now()
    while (messages.length === 0 && Date.now() - start < 5000) {
      await Bun.sleep(10)
    }

    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages[0]!.source).toBe('proactive')
  })
})
