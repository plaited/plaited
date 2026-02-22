import { describe, expect, test } from 'bun:test'
import { TOOL_STATUS } from '../agent.constants.ts'
import type { AgentToolCall, ToolResult } from '../agent.schemas.ts'
import { TrajectoryStepSchema } from '../agent.schemas.ts'
import { createAgentLoop } from '../agent.ts'
import type { InferenceCall } from '../agent.types.ts'

// ============================================================================
// Test helpers
// ============================================================================

/** Creates a mock InferenceCall that returns responses from a queue */
const createMockInference = (
  responses: Array<{
    content?: string | null
    tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
    reasoning_content?: string | null
  }>,
): InferenceCall => {
  let callIndex = 0
  return async () => {
    const msg = responses[callIndex] ?? { content: 'Fallback: no more mock responses' }
    callIndex++
    return { choices: [{ message: msg }] }
  }
}

/** Creates a mock ToolExecutor that returns canned results by tool name */
const createMockToolExecutor = (results: Record<string, unknown>) => {
  return async (toolCall: AgentToolCall): Promise<ToolResult> => ({
    toolCallId: toolCall.id,
    name: toolCall.name,
    status: TOOL_STATUS.completed,
    output: results[toolCall.name] ?? `Result for ${toolCall.name}`,
  })
}

/** Shorthand for a tool_calls response */
const toolCallResponse = (id: string, name: string, args: Record<string, unknown> = {}) => ({
  tool_calls: [{ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } }],
})

/** Shorthand for a message response */
const messageResponse = (content: string) => ({ content })

/** Shorthand for a response with thinking */
const thinkingResponse = (thinking: string, content: string) => ({
  reasoning_content: thinking,
  content,
})

// ============================================================================
// Loop Tests
// ============================================================================

describe('createAgentLoop', () => {
  test('single tool call loop: task → reason → gate → execute → result → message', async () => {
    const inference = createMockInference([
      // 1st response: tool call
      { ...toolCallResponse('tc-1', 'read_file', { path: '/foo.ts' }), reasoning_content: 'I should read the file' },
      // 2nd response (after tool result): final message
      messageResponse('The file contains a function.'),
    ])
    const toolExecutor = createMockToolExecutor({ read_file: 'export const foo = 42' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Read /foo.ts')

    expect(result.output).toBe('The file contains a function.')
    expect(result.trajectory.length).toBeGreaterThanOrEqual(3)

    // Validate trajectory types
    const types = result.trajectory.map((s) => s.type)
    expect(types).toContain('thought')
    expect(types).toContain('tool_call')
    expect(types).toContain('message')

    // Every step should pass schema validation
    for (const step of result.trajectory) {
      expect(TrajectoryStepSchema.safeParse(step).success).toBe(true)
    }

    // Tool call should have completed status
    const toolStep = result.trajectory.find((s) => s.type === 'tool_call')
    expect(toolStep).toBeDefined()
    if (toolStep?.type === 'tool_call') {
      expect(toolStep.name).toBe('read_file')
      expect(toolStep.status).toBe('completed')
    }

    loop.destroy()
  })

  test('message-only response: no tool calls', async () => {
    const inference = createMockInference([messageResponse('Hello! How can I help?')])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Hello')

    expect(result.output).toBe('Hello! How can I help?')
    expect(result.trajectory).toHaveLength(1)
    expect(result.trajectory[0]?.type).toBe('message')
    expect(result.trajectory[0]?.type === 'message' && result.trajectory[0].content).toBe('Hello! How can I help?')

    loop.destroy()
  })

  test('thinking is recorded in trajectory', async () => {
    const inference = createMockInference([thinkingResponse('Let me think about this...', 'The answer is 42.')])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('What is the answer?')

    expect(result.output).toBe('The answer is 42.')
    const thoughtStep = result.trajectory.find((s) => s.type === 'thought')
    expect(thoughtStep).toBeDefined()
    if (thoughtStep?.type === 'thought') {
      expect(thoughtStep.content).toBe('Let me think about this...')
    }

    loop.destroy()
  })

  test('think tags in content are extracted', async () => {
    const inference = createMockInference([
      { content: '<think>I need to consider this carefully</think>The result is positive.' },
    ])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Analyze this')

    expect(result.output).toBe('The result is positive.')
    const thoughtStep = result.trajectory.find((s) => s.type === 'thought')
    expect(thoughtStep).toBeDefined()
    if (thoughtStep?.type === 'thought') {
      expect(thoughtStep.content).toBe('I need to consider this carefully')
    }

    loop.destroy()
  })

  test('plan-first cycle: save_plan → plan_saved → tool call → message', async () => {
    const plan = {
      goal: 'Update the config',
      steps: [
        { id: 's1', intent: 'Read config', tools: ['read_file'] },
        { id: 's2', intent: 'Write config', tools: ['write_file'] },
      ],
    }
    const inference = createMockInference([
      // 1st response: save_plan tool call
      {
        tool_calls: [
          {
            id: 'tc-plan',
            type: 'function' as const,
            function: { name: 'save_plan', arguments: JSON.stringify(plan) },
          },
        ],
      },
      // 2nd response (after plan saved): real tool call
      toolCallResponse('tc-1', 'read_file', { path: '/config.json' }),
      // 3rd response (after tool result): final message
      messageResponse('Config has been updated.'),
    ])
    const toolExecutor = createMockToolExecutor({ read_file: '{"key": "value"}' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Update the config')

    expect(result.output).toBe('Config has been updated.')

    const types = result.trajectory.map((s) => s.type)
    expect(types).toContain('plan')
    expect(types).toContain('tool_call')
    expect(types).toContain('message')

    // Plan step should have entries
    const planStep = result.trajectory.find((s) => s.type === 'plan')
    expect(planStep).toBeDefined()
    if (planStep?.type === 'plan') {
      expect(planStep.entries).toHaveLength(2)
    }

    loop.destroy()
  })

  test('max iterations safety: terminates runaway loops', async () => {
    // Mock that always returns tool calls (never a final message)
    let callCount = 0
    const inference: InferenceCall = async () => {
      callCount++
      return {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: `tc-${callCount}`,
                  type: 'function',
                  function: { name: 'list_files', arguments: '{}' },
                },
              ],
            },
          },
        ],
      }
    }
    const toolExecutor = createMockToolExecutor({ list_files: ['file1.ts', 'file2.ts'] })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 3, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('List all files recursively')

    expect(result.output).toBe('Max iterations (3) reached')

    // Should have exactly 3 tool_call steps in trajectory
    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(3)

    // All steps should pass schema validation
    for (const step of result.trajectory) {
      expect(TrajectoryStepSchema.safeParse(step).success).toBe(true)
    }

    loop.destroy()
  })

  test('multiple loop iterations: 3 tool calls then message', async () => {
    const inference = createMockInference([
      toolCallResponse('tc-1', 'read_file', { path: '/a.ts' }),
      toolCallResponse('tc-2', 'read_file', { path: '/b.ts' }),
      toolCallResponse('tc-3', 'write_file', { path: '/c.ts', content: 'merged' }),
      messageResponse('Done! Merged 3 files.'),
    ])
    const toolExecutor = createMockToolExecutor({
      read_file: 'contents',
      write_file: 'written',
    })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Merge files a.ts, b.ts into c.ts')

    expect(result.output).toBe('Done! Merged 3 files.')

    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(3)

    if (toolCalls[0]?.type === 'tool_call') expect(toolCalls[0].name).toBe('read_file')
    if (toolCalls[1]?.type === 'tool_call') expect(toolCalls[1].name).toBe('read_file')
    if (toolCalls[2]?.type === 'tool_call') expect(toolCalls[2].name).toBe('write_file')

    loop.destroy()
  })

  test('destroy cleanup: resolves pending promise', async () => {
    // Mock that never responds (hangs forever)
    const inference: InferenceCall = () => new Promise(() => {})
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    // Start run (won't complete because inference hangs)
    const runPromise = loop.run('Hello')

    // Destroy should resolve the pending promise
    loop.destroy()

    const result = await runPromise
    expect(result.output).toBe('')
    expect(result.trajectory).toHaveLength(0)
  })

  test('inference error is handled gracefully', async () => {
    const inference: InferenceCall = async () => {
      throw new Error('Connection refused')
    }
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Hello')

    expect(result.output).toContain('Error: Connection refused')

    loop.destroy()
  })

  test('tool executor error is handled gracefully', async () => {
    const inference = createMockInference([
      toolCallResponse('tc-1', 'dangerous_tool', {}),
      messageResponse('Tool failed, here is what happened.'),
    ])
    const toolExecutor = async () => {
      throw new Error('Sandbox violation')
    }

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Do something dangerous')

    expect(result.output).toBe('Tool failed, here is what happened.')

    // Failed tool call should be in trajectory
    const failedTool = result.trajectory.find((s) => s.type === 'tool_call' && s.status === 'failed')
    expect(failedTool).toBeDefined()

    loop.destroy()
  })

  test('empty model response terminates with empty output', async () => {
    const inference = createMockInference([{ content: null }])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Hello')

    expect(result.output).toBe('')
    expect(result.trajectory).toHaveLength(1)
    expect(result.trajectory[0]?.type).toBe('message')

    loop.destroy()
  })

  test('trajectory steps have valid timestamps', async () => {
    const before = Date.now()
    const inference = createMockInference([
      { ...toolCallResponse('tc-1', 'test_tool', {}), reasoning_content: 'thinking' },
      messageResponse('done'),
    ])
    const toolExecutor = createMockToolExecutor({ test_tool: 'result' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Test timestamps')
    const after = Date.now()

    for (const step of result.trajectory) {
      expect(step.timestamp).toBeGreaterThanOrEqual(before)
      expect(step.timestamp).toBeLessThanOrEqual(after)
    }

    loop.destroy()
  })
})
