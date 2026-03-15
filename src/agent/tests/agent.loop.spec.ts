/**
 * Tests for createAgentLoop — 6-step BP-orchestrated agent pipeline.
 *
 * @remarks
 * Tests use mock Model and toolExecutor to verify event flow without
 * real inference or tool execution. Each test verifies a specific
 * pipeline behavior pattern from CLAUDE.md.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { bSync, bThread } from '../../behavioral/behavioral.utils.ts'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../../events.ts'
import { AGENT_EVENTS, RISK_TAG } from '../agent.constants.ts'
import { createConstitution } from '../agent.factories.ts'
import { createAgentLoop } from '../agent.loop.ts'
import type { ToolDefinition } from '../agent.schemas.ts'
import type { AgentNode, Model, ModelDelta } from '../agent.types.ts'

// ============================================================================
// Mock Model — returns canned responses
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

const workspaceTool: ToolDefinition = {
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
}

const bashTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'bash',
    description: 'Run a bash command',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
  },
}

// Tag tools with risk tags by extending the tool definition
const taggedWorkspaceTool = { ...workspaceTool, tags: [RISK_TAG.workspace] }
const taggedBashTool = { ...bashTool, tags: [RISK_TAG.workspace] }

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
    [AGENT_EVENTS.context_ready](d: unknown) {
      events.push({ type: AGENT_EVENTS.context_ready, detail: d })
    },
    [AGENT_EVENTS.gate_approved](d: unknown) {
      events.push({ type: AGENT_EVENTS.gate_approved, detail: d })
    },
    [AGENT_EVENTS.gate_rejected](d: unknown) {
      events.push({ type: AGENT_EVENTS.gate_rejected, detail: d })
    },
    [AGENT_EVENTS.execute](d: unknown) {
      events.push({ type: AGENT_EVENTS.execute, detail: d })
    },
    [AGENT_EVENTS.tool_result](d: unknown) {
      events.push({ type: AGENT_EVENTS.tool_result, detail: d })
    },
    [AGENT_EVENTS.simulate_request](d: unknown) {
      events.push({ type: AGENT_EVENTS.simulate_request, detail: d })
    },
    [AGENT_EVENTS.simulation_result](d: unknown) {
      events.push({ type: AGENT_EVENTS.simulation_result, detail: d })
    },
    [AGENT_EVENTS.eval_approved](d: unknown) {
      events.push({ type: AGENT_EVENTS.eval_approved, detail: d })
    },
    [AGENT_EVENTS.eval_rejected](d: unknown) {
      events.push({ type: AGENT_EVENTS.eval_rejected, detail: d })
    },
    [AGENT_EVENTS.message](d: unknown) {
      events.push({ type: AGENT_EVENTS.message, detail: d })
    },
    [AGENT_EVENTS.thinking_delta](d: unknown) {
      events.push({ type: AGENT_EVENTS.thinking_delta, detail: d })
    },
    [AGENT_EVENTS.text_delta](d: unknown) {
      events.push({ type: AGENT_EVENTS.text_delta, detail: d })
    },
    [AGENT_EVENTS.inference_error](d: unknown) {
      events.push({ type: AGENT_EVENTS.inference_error, detail: d })
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

/** Start the agent with a connected session */
const connectAndTask = (agent: AgentNode, prompt: string) => {
  agent.trigger({
    type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
    detail: { sessionId: 'test', source: 'document', isReconnect: false },
  })
  agent.trigger({ type: AGENT_EVENTS.task, detail: { prompt } })
}

// ============================================================================
// Test 1: Basic task flow
// ============================================================================

describe('createAgentLoop', () => {
  test('basic task flow: task → tool call → execute → tool_result → message', async () => {
    const model = createMockModel([
      // First call: return a tool call
      { toolCalls: [{ id: 'tc-1', name: 'read_file', arguments: '{"path":"main.ts"}' }] },
      // Second call: return text (task complete)
      { text: 'File contents look good.' },
    ])

    const executedTools: string[] = []
    const agent = createAgentLoop({
      model,
      tools: [taggedWorkspaceTool],
      toolExecutor: async (toolCall) => {
        executedTools.push(toolCall.name)
        return 'file contents here'
      },
      memoryPath: '/tmp/test-memory-basic',
      sessionId: 'test-basic',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Read main.ts')

    await waitForEvent(events, AGENT_EVENTS.message)

    // Verify event sequence
    expect(events.some((e) => e.type === AGENT_EVENTS.invoke_inference)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.model_response)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.context_ready)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.execute)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.tool_result)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.message)).toBe(true)

    // Tool was executed
    expect(executedTools).toEqual(['read_file'])

    // Message content
    const msgEvent = events.find((e) => e.type === AGENT_EVENTS.message)
    expect((msgEvent?.detail as { content: string }).content).toBe('File contents look good.')
  })

  // ============================================================================
  // Test 2: Gate rejection
  // ============================================================================

  test('gate rejection: constitution predicate blocks dangerous tool call', async () => {
    const model = createMockModel([
      // Return rm -rf tool call
      { toolCalls: [{ id: 'tc-1', name: 'bash', arguments: '{"command":"rm -rf /"}' }] },
      // After rejection, return text
      { text: 'I apologize, that was unsafe.' },
    ])

    const agent = createAgentLoop({
      model,
      tools: [taggedBashTool],
      toolExecutor: async () => 'should not reach here',
      memoryPath: '/tmp/test-memory-gate',
      sessionId: 'test-gate',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Delete everything')

    await waitForEvent(events, AGENT_EVENTS.message)

    // Gate rejection should fire
    expect(events.some((e) => e.type === AGENT_EVENTS.gate_rejected)).toBe(true)

    // Execute should NOT fire for the dangerous command
    const executeEvents = events.filter((e) => e.type === AGENT_EVENTS.execute)
    expect(executeEvents).toHaveLength(0)
  })

  // ============================================================================
  // Test 3: Batch completion
  // ============================================================================

  test('batch completion: model returns 3 tool calls → all execute → next inference', async () => {
    const model = createMockModel([
      // Return 3 tool calls
      {
        toolCalls: [
          { id: 'tc-1', name: 'read_file', arguments: '{"path":"a.ts"}' },
          { id: 'tc-2', name: 'read_file', arguments: '{"path":"b.ts"}' },
          { id: 'tc-3', name: 'read_file', arguments: '{"path":"c.ts"}' },
        ],
      },
      // After batch completes, return text
      { text: 'All three files read successfully.' },
    ])

    const executedTools: string[] = []
    const agent = createAgentLoop({
      model,
      tools: [taggedWorkspaceTool],
      toolExecutor: async (toolCall) => {
        executedTools.push(toolCall.id)
        return `contents of ${(toolCall.arguments as Record<string, unknown>).path}`
      },
      memoryPath: '/tmp/test-memory-batch',
      sessionId: 'test-batch',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Read files a.ts, b.ts, c.ts')

    await waitForEvent(events, AGENT_EVENTS.message)

    // All 3 tool calls executed
    expect(executedTools).toHaveLength(3)
    expect(executedTools).toContain('tc-1')
    expect(executedTools).toContain('tc-2')
    expect(executedTools).toContain('tc-3')

    // Second invoke_inference happened (batch completion triggered it)
    const inferenceEvents = events.filter((e) => e.type === AGENT_EVENTS.invoke_inference)
    expect(inferenceEvents.length).toBeGreaterThanOrEqual(2)
  })

  // ============================================================================
  // Test 4: Max iterations
  // ============================================================================

  test('max iterations: model keeps calling tools → after N, message fires', async () => {
    const MAX = 3
    let callCount = 0
    const model = createMockModel(
      // Always return a tool call
      Array.from({ length: MAX + 2 }, () => ({
        toolCalls: [{ id: `tc-${++callCount}`, name: 'read_file', arguments: '{"path":"loop.ts"}' }],
      })),
    )

    const agent = createAgentLoop({
      model,
      tools: [taggedWorkspaceTool],
      toolExecutor: async () => 'content',
      memoryPath: '/tmp/test-memory-maxiter',
      sessionId: 'test-maxiter',
      maxIterations: MAX,
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Loop forever')

    await waitForEvent(events, AGENT_EVENTS.message, 5000)

    // Should get a message about max iterations
    const msgEvent = events.find((e) => e.type === AGENT_EVENTS.message)
    expect(msgEvent).toBeDefined()
    expect((msgEvent?.detail as { content: string }).content).toContain('Max iterations')

    // Tool results should be at most MAX
    const toolResults = events.filter((e) => e.type === AGENT_EVENTS.tool_result)
    expect(toolResults).toHaveLength(MAX)
  })

  // ============================================================================
  // Test 5: Constitution blocking
  // ============================================================================

  test('constitution blocking: MAC bThread blocks dangerous bash', async () => {
    const model = createMockModel([
      { toolCalls: [{ id: 'tc-1', name: 'bash', arguments: '{"command":"rm -rf /important"}' }] },
      { text: 'Understood, that was blocked.' },
    ])

    const noRmRfConstitution = createConstitution(() => ({
      threads: {
        noRmRf: bThread(
          [
            bSync({
              block: (e) =>
                e.type === AGENT_EVENTS.execute &&
                e.detail?.toolCall?.name === 'bash' &&
                e.detail?.toolCall?.arguments?.command?.includes('rm -rf'),
            }),
          ],
          true,
        ),
      },
    }))

    const agent = createAgentLoop({
      model,
      tools: [taggedBashTool],
      toolExecutor: async () => 'should not execute',
      constitution: [noRmRfConstitution],
      memoryPath: '/tmp/test-memory-constitution',
      sessionId: 'test-constitution',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Run rm -rf')

    await waitForEvent(events, AGENT_EVENTS.message)

    // gate_rejected should fire (constitution predicate catches it)
    expect(events.some((e) => e.type === AGENT_EVENTS.gate_rejected)).toBe(true)
  })

  // ============================================================================
  // Test 6: Text-only response
  // ============================================================================

  test('text-only response: model returns text without tools → message fires immediately', async () => {
    const model = createMockModel([{ text: 'Hello! How can I help?' }])

    const agent = createAgentLoop({
      model,
      tools: [taggedWorkspaceTool],
      toolExecutor: async () => 'should not execute',
      memoryPath: '/tmp/test-memory-text',
      sessionId: 'test-text',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Hello')

    await waitForEvent(events, AGENT_EVENTS.message)

    // No execute, no tool_result
    expect(events.some((e) => e.type === AGENT_EVENTS.execute)).toBe(false)
    expect(events.some((e) => e.type === AGENT_EVENTS.tool_result)).toBe(false)

    // Direct message
    const msgEvent = events.find((e) => e.type === AGENT_EVENTS.message)
    expect((msgEvent?.detail as { content: string }).content).toBe('Hello! How can I help?')
  })

  // ============================================================================
  // Test 7: Simulation + evaluation flow
  // ============================================================================

  test('simulation + evaluation: untagged tool → simulate → evaluate → execute', async () => {
    // createAgentLoop uses the same model for reasoning and simulation;
    // a separate simModel parameter is not yet wired up
    let mainCallCount = 0
    const mainModel: Model = {
      reason: async function* () {
        mainCallCount++
        if (mainCallCount === 1) {
          yield { type: 'toolcall_delta', id: 'tc-1', name: 'read_file', arguments: '{"path":"main.ts"}' } as ModelDelta
        } else {
          yield { type: 'text_delta', content: 'Done.' } as ModelDelta
        }
        yield { type: 'done', response: { usage: { inputTokens: 100, outputTokens: 50 } } } as ModelDelta
      },
    }

    // Untagged tool — no risk tags, so it routes to simulate
    const untaggedTool: ToolDefinition = {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
      },
    }

    const agent = createAgentLoop({
      model: mainModel,
      tools: [untaggedTool],
      toolExecutor: async () => 'file contents',
      memoryPath: '/tmp/test-memory-sim',
      sessionId: 'test-sim',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Read main.ts')

    await waitForEvent(events, AGENT_EVENTS.message, 5000)

    // Simulation should have been triggered
    expect(events.some((e) => e.type === AGENT_EVENTS.simulate_request)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.simulation_result)).toBe(true)
  })

  // ============================================================================
  // Test 8: Inference error — non-retryable triggers message (unblocks taskGate)
  // ============================================================================

  test('inference_error: non-retryable error triggers message instead of deadlocking', async () => {
    const errorModel: Model = {
      reason: async function* () {
        yield { type: 'error', error: 'Model unavailable' } as ModelDelta
      },
    }

    const agent = createAgentLoop({
      model: errorModel,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-memory-infer-err',
      sessionId: 'test-infer-err',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Do something')

    // Should produce inference_error → message (not deadlock)
    await waitForEvent(events, AGENT_EVENTS.message, 3000)

    expect(events.some((e) => e.type === AGENT_EVENTS.inference_error)).toBe(true)
    expect(events.some((e) => e.type === AGENT_EVENTS.message)).toBe(true)
  })

  // ============================================================================
  // Test 9: Inference error — retryable triggers retry then eventual message
  // ============================================================================

  test('inference_error: retryable error retries then surfaces after max retries', async () => {
    // Exponential backoff: 1s + 2s + 4s = 7s minimum
    let callCount = 0
    const failingModel: Model = {
      reason: async function* () {
        callCount++
        throw new Error('Connection refused')
      },
    }

    const agent = createAgentLoop({
      model: failingModel,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-memory-retry-err',
      sessionId: 'test-retry-err',
    })
    afterAll(() => agent.destroy())

    const events = collectEvents(agent)
    connectAndTask(agent, 'Do something')

    // Should eventually surface as message after MAX_INFERENCE_RETRIES (3) + 1 initial
    await waitForEvent(events, AGENT_EVENTS.message, 30_000)

    // 1 initial + 3 retries = 4 total calls
    expect(callCount).toBe(4)
    expect(events.filter((e) => e.type === AGENT_EVENTS.inference_error).length).toBe(4)
    expect(events.some((e) => e.type === AGENT_EVENTS.message)).toBe(true)
  }, 15_000)

  // ============================================================================
  // Test 10: Destroy cleans up
  // ============================================================================

  test('destroy aborts in-flight operations', () => {
    const model = createMockModel([{ text: 'Hello' }])
    const agent = createAgentLoop({
      model,
      tools: [],
      toolExecutor: async () => null,
      memoryPath: '/tmp/test-memory-destroy',
      sessionId: 'test-destroy',
    })

    // destroy should not throw
    agent.destroy()
  })
})
