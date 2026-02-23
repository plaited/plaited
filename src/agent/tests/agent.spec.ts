import { describe, expect, test } from 'bun:test'
import { RISK_CLASS, TOOL_STATUS } from '../agent.constants.ts'
import { createMemoryDb } from '../agent.memory.ts'
import type { AgentToolCall, ToolResult } from '../agent.schemas.ts'
import { TrajectoryStepSchema } from '../agent.schemas.ts'
import { createAgentLoop } from '../agent.ts'
import type { Evaluate, GateCheck, InferenceCall, Simulate } from '../agent.types.ts'

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

/** Shorthand for a multi-tool_calls response */
const multiToolCallResponse = (...calls: Array<[id: string, name: string, args?: Record<string, unknown>]>) => ({
  tool_calls: calls.map(([id, name, args = {}]) => ({
    id,
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  })),
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

// ============================================================================
// Gate Check Integration
// ============================================================================

describe('createAgentLoop — gateCheck integration', () => {
  test('rejection triggers gate_rejected and re-invokes inference', async () => {
    const rejectAll: GateCheck = (tc) => ({
      approved: false,
      riskClass: RISK_CLASS.high_ambiguity,
      reason: `Blocked: ${tc.name}`,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'bash', { command: 'echo hi' }),
      // After rejection, model responds with a message
      messageResponse('I cannot run bash commands.'),
    ])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck: rejectAll,
    })

    const result = await loop.run('Run echo hi')
    expect(result.output).toBe('I cannot run bash commands.')

    // No tool_call steps in trajectory (rejected before execution)
    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(0)

    loop.destroy()
  })

  test('defaults to approve-all when gateCheck not provided', async () => {
    const inference = createMockInference([
      toolCallResponse('tc-1', 'read_file', { path: 'file.ts' }),
      messageResponse('File contents here.'),
    ])
    const toolExecutor = createMockToolExecutor({ read_file: 'contents' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      // No gateCheck — should default to approve-all
    })

    const result = await loop.run('Read file')
    expect(result.output).toBe('File contents here.')

    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(1)

    loop.destroy()
  })
})

// ============================================================================
// Multi-Tool Support
// ============================================================================

describe('createAgentLoop — multi-tool', () => {
  test('processes all tool calls sequentially', async () => {
    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        status: TOOL_STATUS.completed,
        output: `Result for ${toolCall.name}`,
      }
    }

    const inference = createMockInference([
      // Single response with 3 tool calls
      multiToolCallResponse(
        ['tc-1', 'read_file', { path: '/a.ts' }],
        ['tc-2', 'read_file', { path: '/b.ts' }],
        ['tc-3', 'write_file', { path: '/c.ts', content: 'merged' }],
      ),
      // After all 3 processed, final message
      messageResponse('Merged successfully.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Merge files')
    expect(result.output).toBe('Merged successfully.')

    // All 3 tools should have been executed
    expect(executedTools).toEqual(['read_file', 'read_file', 'write_file'])

    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(3)

    loop.destroy()
  })

  test('gate rejection skips to next tool call', async () => {
    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        status: TOOL_STATUS.completed,
        output: `Result for ${toolCall.name}`,
      }
    }

    // Gate that only rejects bash
    const gateCheck: GateCheck = (tc) => {
      if (tc.name === 'bash') {
        return { approved: false, riskClass: RISK_CLASS.high_ambiguity, reason: 'Bash blocked' }
      }
      return { approved: true, riskClass: RISK_CLASS.read_only }
    }

    const inference = createMockInference([
      // Response with bash (blocked) + read_file (allowed)
      multiToolCallResponse(['tc-1', 'bash', { command: 'rm stuff' }], ['tc-2', 'read_file', { path: '/safe.ts' }]),
      // After processing both, final message
      messageResponse('Completed with one rejection.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
    })

    const result = await loop.run('Run bash and read file')
    expect(result.output).toBe('Completed with one rejection.')

    // Only read_file should have been executed (bash was rejected)
    expect(executedTools).toEqual(['read_file'])

    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(1)

    loop.destroy()
  })

  test('re-invokes inference after all tool calls processed', async () => {
    let inferenceCallCount = 0
    const inference: InferenceCall = async () => {
      inferenceCallCount++
      if (inferenceCallCount === 1) {
        // First call: return 2 tool calls
        return {
          choices: [
            {
              message: {
                tool_calls: [
                  { id: 'tc-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } },
                  { id: 'tc-2', type: 'function', function: { name: 'read_file', arguments: '{"path":"b.ts"}' } },
                ],
              },
            },
          ],
        }
      }
      // Second call (after both tools processed): final message
      return { choices: [{ message: { content: 'Done reading both files.' } }] }
    }

    const toolExecutor = createMockToolExecutor({ read_file: 'file contents' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const result = await loop.run('Read both files')
    expect(result.output).toBe('Done reading both files.')

    // Inference should have been called exactly 2 times:
    // 1st: returns 2 tool calls, 2nd: returns final message
    expect(inferenceCallCount).toBe(2)

    loop.destroy()
  })
})

// ============================================================================
// Simulate / Evaluate Integration
// ============================================================================

describe('createAgentLoop — simulate/evaluate', () => {
  test('read_only skips simulation even with simulate provided', async () => {
    let simulateCalled = false
    const simulate: Simulate = async () => {
      simulateCalled = true
      return 'prediction'
    }

    // Gate classifies read_file as read_only
    const gateCheck: GateCheck = (tc) => ({
      approved: true,
      riskClass: tc.name === 'read_file' ? RISK_CLASS.read_only : RISK_CLASS.side_effects,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'read_file', { path: '/foo.ts' }),
      messageResponse('Done.'),
    ])
    const toolExecutor = createMockToolExecutor({ read_file: 'contents' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
    })

    const result = await loop.run('Read a file')
    expect(result.output).toBe('Done.')
    expect(simulateCalled).toBe(false)

    loop.destroy()
  })

  test('side_effects triggers simulation', async () => {
    let simulateCalled = false
    const simulate: Simulate = async () => {
      simulateCalled = true
      return 'File written successfully.'
    }

    const gateCheck: GateCheck = (tc) => ({
      approved: true,
      riskClass: tc.name === 'write_file' ? RISK_CLASS.side_effects : RISK_CLASS.read_only,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'write_file', { path: '/app.ts', content: 'hi' }),
      messageResponse('Written.'),
    ])
    const toolExecutor = createMockToolExecutor({ write_file: 'ok' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
    })

    const result = await loop.run('Write a file')
    expect(result.output).toBe('Written.')
    expect(simulateCalled).toBe(true)

    loop.destroy()
  })

  test('simulate not provided preserves Wave 1 behavior', async () => {
    const gateCheck: GateCheck = () => ({
      approved: true,
      riskClass: RISK_CLASS.side_effects,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'write_file', { path: '/x.ts', content: 'y' }),
      messageResponse('Done without simulation.'),
    ])
    const toolExecutor = createMockToolExecutor({ write_file: 'ok' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      // No simulate — should execute directly
    })

    const result = await loop.run('Write file')
    expect(result.output).toBe('Done without simulation.')

    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(1)

    loop.destroy()
  })

  test('simulation → evaluation end-to-end', async () => {
    const simulate: Simulate = async () => 'File will be written successfully.'
    const evaluate: Evaluate = async () => ({ approved: true, score: 0.9 })

    const gateCheck: GateCheck = () => ({
      approved: true,
      riskClass: RISK_CLASS.side_effects,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'write_file', { path: '/app.ts', content: 'data' }),
      messageResponse('All done.'),
    ])
    const toolExecutor = createMockToolExecutor({ write_file: 'ok' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
      evaluate,
    })

    const result = await loop.run('Write file')
    expect(result.output).toBe('All done.')

    const toolCalls = result.trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(1)

    loop.destroy()
  })

  test('eval_approved leads to execution', async () => {
    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return { toolCallId: toolCall.id, name: toolCall.name, status: TOOL_STATUS.completed, output: 'ok' }
    }

    const simulate: Simulate = async () => 'Safe prediction.'
    const evaluate: Evaluate = async () => ({ approved: true })

    const gateCheck: GateCheck = () => ({
      approved: true,
      riskClass: RISK_CLASS.high_ambiguity,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'bash', { command: 'echo hi' }),
      messageResponse('Done.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
      evaluate,
    })

    const result = await loop.run('Run echo')
    expect(result.output).toBe('Done.')
    expect(executedTools).toEqual(['bash'])

    loop.destroy()
  })

  test('eval_rejected produces synthetic tool result', async () => {
    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return { toolCallId: toolCall.id, name: toolCall.name, status: TOOL_STATUS.completed, output: 'ok' }
    }

    const simulate: Simulate = async () => 'Safe text here.'
    const evaluate: Evaluate = async () => ({ approved: false, reason: 'Score too low', score: 0.1 })

    const gateCheck: GateCheck = () => ({
      approved: true,
      riskClass: RISK_CLASS.high_ambiguity,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'bash', { command: 'dangerous cmd' }),
      messageResponse('I will try a different approach.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
      evaluate,
    })

    const result = await loop.run('Do something')
    expect(result.output).toBe('I will try a different approach.')
    // Tool should NOT have been executed (eval rejected)
    expect(executedTools).toHaveLength(0)

    loop.destroy()
  })

  test('simulate error fails open — executes anyway', async () => {
    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return { toolCallId: toolCall.id, name: toolCall.name, status: TOOL_STATUS.completed, output: 'ok' }
    }

    const simulate: Simulate = async () => {
      throw new Error('Dreamer crashed')
    }

    const gateCheck: GateCheck = () => ({
      approved: true,
      riskClass: RISK_CLASS.side_effects,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'write_file', { path: '/x.ts', content: 'y' }),
      messageResponse('Done despite simulation failure.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
    })

    const result = await loop.run('Write file')
    expect(result.output).toBe('Done despite simulation failure.')
    expect(executedTools).toEqual(['write_file'])

    loop.destroy()
  })

  test('evaluate error fails open — executes anyway', async () => {
    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return { toolCallId: toolCall.id, name: toolCall.name, status: TOOL_STATUS.completed, output: 'ok' }
    }

    const simulate: Simulate = async () => 'Safe prediction.'
    const evaluate: Evaluate = async () => {
      throw new Error('Judge crashed')
    }

    const gateCheck: GateCheck = () => ({
      approved: true,
      riskClass: RISK_CLASS.high_ambiguity,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'bash', { command: 'echo hi' }),
      messageResponse('Done despite judge failure.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
      evaluate,
    })

    const result = await loop.run('Run echo')
    expect(result.output).toBe('Done despite judge failure.')
    expect(executedTools).toEqual(['bash'])

    loop.destroy()
  })

  test('symbolicSafetyNet bThread blocks execute on dangerous prediction', async () => {
    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return { toolCallId: toolCall.id, name: toolCall.name, status: TOOL_STATUS.completed, output: 'ok' }
    }

    // Simulate returns a dangerous prediction
    const simulate: Simulate = async () => 'This will cause data loss in the database.'
    // No evaluate — symbolic gate in simulation_result handler catches it

    const gateCheck: GateCheck = () => ({
      approved: true,
      riskClass: RISK_CLASS.side_effects,
    })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'write_file', { path: '/danger.ts', content: 'bad' }),
      messageResponse('Blocked by safety net.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
    })

    const result = await loop.run('Write dangerous file')
    expect(result.output).toBe('Blocked by safety net.')
    // Tool should NOT have been executed (symbolic gate blocked)
    expect(executedTools).toHaveLength(0)

    loop.destroy()
  })

  test('multi-tool parallel: reads execute while side-effects simulate', async () => {
    const executionOrder: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executionOrder.push(toolCall.name)
      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        status: TOOL_STATUS.completed,
        output: `result-${toolCall.name}`,
      }
    }

    const simulate: Simulate = async () => 'File will be written.'

    const gateCheck: GateCheck = (tc) => ({
      approved: true,
      riskClass: tc.name === 'read_file' ? RISK_CLASS.read_only : RISK_CLASS.side_effects,
    })

    const inference = createMockInference([
      // Single response with mixed risk classes
      multiToolCallResponse(
        ['tc-1', 'read_file', { path: '/a.ts' }],
        ['tc-2', 'write_file', { path: '/b.ts', content: 'x' }],
        ['tc-3', 'read_file', { path: '/c.ts' }],
      ),
      messageResponse('All processed.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
    })

    const result = await loop.run('Read and write')
    expect(result.output).toBe('All processed.')

    // All 3 tools should have been executed (reads directly, write after simulation)
    expect(executionOrder).toHaveLength(3)
    expect(executionOrder).toContain('read_file')
    expect(executionOrder).toContain('write_file')

    loop.destroy()
  })

  test('pendingToolCallCount reaches 0 before re-invoking inference', async () => {
    let inferenceCallCount = 0
    const inference: InferenceCall = async () => {
      inferenceCallCount++
      if (inferenceCallCount === 1) {
        return {
          choices: [
            {
              message: {
                tool_calls: [
                  { id: 'tc-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } },
                  {
                    id: 'tc-2',
                    type: 'function',
                    function: { name: 'write_file', arguments: '{"path":"b.ts","content":"x"}' },
                  },
                ],
              },
            },
          ],
        }
      }
      return { choices: [{ message: { content: 'All done.' } }] }
    }

    const simulate: Simulate = async () => 'File written.'
    const gateCheck: GateCheck = (tc) => ({
      approved: true,
      riskClass: tc.name === 'read_file' ? RISK_CLASS.read_only : RISK_CLASS.side_effects,
    })
    const toolExecutor = createMockToolExecutor({ read_file: 'contents', write_file: 'ok' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
    })

    const result = await loop.run('Process both')
    expect(result.output).toBe('All done.')
    // Inference: 1st = tool calls, 2nd = final message (both complete before re-invoke)
    expect(inferenceCallCount).toBe(2)

    loop.destroy()
  })

  test('multi-tool with mixed risk classes: all results collected', async () => {
    const simulate: Simulate = async () => 'Prediction text.'
    const evaluate: Evaluate = async () => ({ approved: true, score: 0.8 })

    const gateCheck: GateCheck = (tc) => {
      if (tc.name === 'read_file') return { approved: true, riskClass: RISK_CLASS.read_only }
      if (tc.name === 'write_file') return { approved: true, riskClass: RISK_CLASS.side_effects }
      return { approved: true, riskClass: RISK_CLASS.high_ambiguity }
    }

    const executedTools: string[] = []
    const toolExecutor = async (toolCall: AgentToolCall): Promise<ToolResult> => {
      executedTools.push(toolCall.name)
      return { toolCallId: toolCall.id, name: toolCall.name, status: TOOL_STATUS.completed, output: 'ok' }
    }

    const inference = createMockInference([
      multiToolCallResponse(
        ['tc-1', 'read_file', { path: '/a.ts' }],
        ['tc-2', 'write_file', { path: '/b.ts', content: 'x' }],
        ['tc-3', 'bash', { command: 'echo test' }],
      ),
      messageResponse('All three completed.'),
    ])

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      gateCheck,
      simulate,
      evaluate,
    })

    const result = await loop.run('Mixed operations')
    expect(result.output).toBe('All three completed.')

    // All 3 should execute: read_file (direct), write_file (simulated), bash (simulated + evaluated)
    expect(executedTools).toHaveLength(3)
    expect(executedTools).toContain('read_file')
    expect(executedTools).toContain('write_file')
    expect(executedTools).toContain('bash')

    loop.destroy()
  })
})

// ============================================================================
// Task Gate + Multi-Run (BP refactor)
// ============================================================================

describe('createAgentLoop — taskGate and multi-run', () => {
  test('multiple sequential run() calls on same loop return correct results', async () => {
    const inference = createMockInference([
      // Run 1: immediate message
      messageResponse('First response.'),
      // Run 2: immediate message
      messageResponse('Second response.'),
    ])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const first = await loop.run('First prompt')
    expect(first.output).toBe('First response.')
    expect(first.trajectory).toHaveLength(1)
    expect(first.trajectory[0]?.type).toBe('message')

    const second = await loop.run('Second prompt')
    expect(second.output).toBe('Second response.')
    expect(second.trajectory).toHaveLength(1)
    expect(second.trajectory[0]?.type).toBe('message')

    loop.destroy()
  })

  test('sequential runs with tool calls: per-task maxIterations resets', async () => {
    const inference = createMockInference([
      // Run 1: tool call then message
      toolCallResponse('tc-1', 'read_file', { path: '/a.ts' }),
      messageResponse('First done.'),
      // Run 2: tool call then message
      toolCallResponse('tc-2', 'read_file', { path: '/b.ts' }),
      messageResponse('Second done.'),
    ])
    const toolExecutor = createMockToolExecutor({ read_file: 'contents' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    const first = await loop.run('First task')
    expect(first.output).toBe('First done.')
    const firstToolCalls = first.trajectory.filter((s) => s.type === 'tool_call')
    expect(firstToolCalls).toHaveLength(1)

    const second = await loop.run('Second task')
    expect(second.output).toBe('Second done.')
    const secondToolCalls = second.trajectory.filter((s) => s.type === 'tool_call')
    expect(secondToolCalls).toHaveLength(1)

    loop.destroy()
  })

  test('maxIterations resets between runs: early message frees thread for reuse', async () => {
    // Run 1 completes after 1 tool call (message interrupts maxIterations mid-sequence).
    // Run 2 must get a fresh maxIterations thread — if it wasn't freed, it would be
    // partially consumed and the counter would be wrong.
    let callCount = 0
    const inference: InferenceCall = async () => {
      callCount++
      // Run 1: 1 tool call, then message
      if (callCount === 1) return { choices: [{ message: toolCallResponse('tc-1', 'read_file', { path: '/a.ts' }) }] }
      if (callCount === 2) return { choices: [{ message: messageResponse('Done early.') }] }
      // Run 2: always returns tool calls — should hit maxIterations=3
      return {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: `tc-r2-${callCount}`,
                  type: 'function',
                  function: { name: 'list_files', arguments: '{}' },
                },
              ],
            },
          },
        ],
      }
    }
    const toolExecutor = createMockToolExecutor({ read_file: 'contents', list_files: ['file.ts'] })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 3, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
    })

    // Run 1: completes early (1 tool call, then message)
    const first = await loop.run('Quick task')
    expect(first.output).toBe('Done early.')

    // Run 2: should have fresh maxIterations (3), hits the limit
    const second = await loop.run('Long task')
    expect(second.output).toBe('Max iterations (3) reached')
    expect(second.trajectory.filter((s) => s.type === 'tool_call')).toHaveLength(3)

    loop.destroy()
  })
})

// ============================================================================
// Memory Integration
// ============================================================================

describe('createAgentLoop — memory integration', () => {
  test('persists session on run completion', async () => {
    const tmpDb = `/tmp/agent-memory-session-${Date.now()}.db`
    const memory = createMemoryDb({ path: tmpDb, workspace: '/tmp' })
    const inference = createMockInference([messageResponse('Hello!')])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      memory,
    })

    const result = await loop.run('Say hello')
    expect(result.output).toBe('Hello!')
    loop.destroy()
    memory.close()

    // Verify session was persisted
    const { Database } = require('bun:sqlite')
    const db = new Database(tmpDb, { readonly: true })
    const sessions = db.prepare('SELECT * FROM sessions').all() as Array<{
      prompt: string
      output: string | null
    }>
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.prompt).toBe('Say hello')
    expect(sessions[0]!.output).toBe('Hello!')
    db.close()

    const { unlink } = require('node:fs/promises')
    await unlink(tmpDb).catch(() => {})
    await unlink(`${tmpDb}-wal`).catch(() => {})
    await unlink(`${tmpDb}-shm`).catch(() => {})
  })

  test('persists messages during tool call loop', async () => {
    const tmpDb = `/tmp/agent-memory-msgs-${Date.now()}.db`
    const memory = createMemoryDb({ path: tmpDb, workspace: '/tmp' })

    const inference = createMockInference([
      toolCallResponse('tc-1', 'read_file', { path: '/foo.ts' }),
      messageResponse('Done reading.'),
    ])
    const toolExecutor = createMockToolExecutor({ read_file: 'file contents' })

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      memory,
    })

    await loop.run('Read foo.ts')
    loop.destroy()
    memory.close()

    // Re-open DB to verify persistence
    const { Database } = require('bun:sqlite')
    const db = new Database(tmpDb, { readonly: true })
    const sessions = db.prepare('SELECT * FROM sessions').all() as Array<{
      prompt: string
      output: string
    }>
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.prompt).toBe('Read foo.ts')
    expect(sessions[0]!.output).toBe('Done reading.')

    const messages = db.prepare('SELECT * FROM messages ORDER BY id').all() as Array<{
      role: string
      content: string | null
      tool_call_id: string | null
    }>
    // Expected: user, assistant (with tool_call), tool (result), assistant (final message)
    expect(messages.length).toBeGreaterThanOrEqual(4)
    expect(messages[0]!.role).toBe('user')
    expect(messages[0]!.content).toBe('Read foo.ts')
    expect(messages[1]!.role).toBe('assistant')
    expect(messages[2]!.role).toBe('tool')
    expect(messages[2]!.tool_call_id).toBe('tc-1')

    const lastMsg = messages[messages.length - 1]!
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.content).toBe('Done reading.')

    db.close()

    const { unlink } = require('node:fs/promises')
    await unlink(tmpDb).catch(() => {})
    await unlink(`${tmpDb}-wal`).catch(() => {})
    await unlink(`${tmpDb}-shm`).catch(() => {})
  })

  test('memory is optional — loop works without it', async () => {
    const inference = createMockInference([messageResponse('Works fine!')])
    const toolExecutor = createMockToolExecutor({})

    const loop = createAgentLoop({
      config: { model: 'test', baseUrl: 'http://test', maxIterations: 10, temperature: 0 },
      inferenceCall: inference,
      toolExecutor,
      // No memory — should work exactly as before
    })

    const result = await loop.run('Test')
    expect(result.output).toBe('Works fine!')

    loop.destroy()
  })
})
