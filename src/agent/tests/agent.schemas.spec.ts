import { describe, expect, test } from 'bun:test'
import {
  AgentConfigSchema,
  AgentPlanSchema,
  AgentPlanStepSchema,
  AgentToolCallSchema,
  GateDecisionSchema,
  ModelUsageSchema,
  RISK_TAG,
  TOOL_STATUS,
  ToolDefinitionSchema,
  ToolResultSchema,
  TrajectoryStepSchema,
} from 'plaited/agent'

describe('AgentToolCallSchema', () => {
  test('validates a complete tool call', () => {
    const result = AgentToolCallSchema.parse({
      id: 'tc-1',
      name: 'read_file',
      arguments: { path: '/src/main.ts' },
    })
    expect(result.id).toBe('tc-1')
    expect(result.name).toBe('read_file')
    expect(result.arguments).toEqual({ path: '/src/main.ts' })
  })

  test('accepts empty arguments', () => {
    const result = AgentToolCallSchema.parse({
      id: 'tc-2',
      name: 'list_files',
      arguments: {},
    })
    expect(result.arguments).toEqual({})
  })

  test('rejects missing id', () => {
    expect(() => AgentToolCallSchema.parse({ name: 'read_file', arguments: {} })).toThrow()
  })

  test('rejects missing name', () => {
    expect(() => AgentToolCallSchema.parse({ id: 'tc-1', arguments: {} })).toThrow()
  })
})

describe('AgentPlanSchema', () => {
  test('validates a plan with steps and dependencies', () => {
    const result = AgentPlanSchema.parse({
      goal: 'Refactor module',
      steps: [
        { id: 's1', intent: 'Read files', tools: ['read_file'] },
        { id: 's2', intent: 'Write changes', tools: ['write_file'], depends: ['s1'] },
      ],
    })
    expect(result.steps).toHaveLength(2)
    expect(result.steps[1].depends).toEqual(['s1'])
  })

  test('defaults depends to undefined when omitted', () => {
    const result = AgentPlanStepSchema.parse({
      id: 's1',
      intent: 'Read files',
      tools: ['read_file'],
    })
    expect(result.depends).toBeUndefined()
  })
})

describe('TrajectoryStepSchema', () => {
  test('validates a thought step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'thought',
      content: 'Analyzing the code...',
      timestamp: Date.now(),
    })
    expect(result.type).toBe('thought')
  })

  test('validates a message step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'message',
      content: 'Here is the result',
      timestamp: Date.now(),
    })
    expect(result.type).toBe('message')
  })

  test('validates a tool_call step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'tool_call',
      name: 'read_file',
      status: TOOL_STATUS.completed,
      input: { path: '/main.ts' },
      output: 'file contents',
      duration: 42,
      timestamp: Date.now(),
    })
    expect(result.type).toBe('tool_call')
  })

  test('validates a plan step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'plan',
      entries: [{ id: 's1', intent: 'Read', tools: ['read_file'] }],
      timestamp: Date.now(),
    })
    expect(result.type).toBe('plan')
  })

  test('rejects unknown step type', () => {
    expect(() =>
      TrajectoryStepSchema.parse({
        type: 'unknown',
        content: 'test',
        timestamp: Date.now(),
      }),
    ).toThrow()
  })

  test('accepts optional stepId on all types', () => {
    const thought = TrajectoryStepSchema.parse({
      type: 'thought',
      content: 'test',
      timestamp: Date.now(),
      stepId: 'step-1',
    })
    expect(thought.stepId).toBe('step-1')
  })
})

describe('ToolResultSchema', () => {
  test('validates a completed result', () => {
    const result = ToolResultSchema.parse({
      toolCallId: 'tc-1',
      name: 'read_file',
      status: TOOL_STATUS.completed,
      output: 'file contents',
      duration: 100,
    })
    expect(result.status).toBe('completed')
  })

  test('validates a failed result with error', () => {
    const result = ToolResultSchema.parse({
      toolCallId: 'tc-2',
      name: 'write_file',
      status: TOOL_STATUS.failed,
      error: 'Permission denied',
    })
    expect(result.status).toBe('failed')
    expect(result.error).toBe('Permission denied')
  })

  test('validates a pending result', () => {
    const result = ToolResultSchema.parse({
      toolCallId: 'tc-3',
      name: 'bash',
      status: TOOL_STATUS.pending,
    })
    expect(result.status).toBe('pending')
  })

  test('rejects invalid status', () => {
    expect(() =>
      ToolResultSchema.parse({
        toolCallId: 'tc-1',
        name: 'read_file',
        status: 'running',
      }),
    ).toThrow()
  })
})

describe('GateDecisionSchema', () => {
  test('validates an approved decision with workspace tag', () => {
    const result = GateDecisionSchema.parse({
      approved: true,
      tags: [RISK_TAG.workspace],
    })
    expect(result.approved).toBe(true)
    expect(result.tags).toEqual(['workspace'])
  })

  test('validates a rejected decision with reason', () => {
    const result = GateDecisionSchema.parse({
      approved: false,
      tags: [RISK_TAG.outbound, RISK_TAG.external_audience],
      reason: 'Sending data to external service requires approval',
    })
    expect(result.approved).toBe(false)
    expect(result.tags).toHaveLength(2)
  })

  test('defaults tags to empty array when omitted', () => {
    const result = GateDecisionSchema.parse({ approved: true })
    expect(result.tags).toEqual([])
  })

  test('accepts multiple composable tags', () => {
    const result = GateDecisionSchema.parse({
      approved: true,
      tags: [RISK_TAG.crosses_boundary, RISK_TAG.inbound, RISK_TAG.irreversible],
    })
    expect(result.tags).toHaveLength(3)
  })

  test('rejects invalid tag values', () => {
    expect(() =>
      GateDecisionSchema.parse({
        approved: true,
        tags: ['nonexistent_tag'],
      }),
    ).toThrow()
  })
})

describe('ToolDefinitionSchema', () => {
  test('validates a complete tool definition', () => {
    const result = ToolDefinitionSchema.parse({
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file from the workspace',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
      },
    })
    expect(result.function.name).toBe('read_file')
  })

  test('accepts minimal definition without parameters', () => {
    const result = ToolDefinitionSchema.parse({
      type: 'function',
      function: { name: 'list_files' },
    })
    expect(result.function.parameters).toBeUndefined()
  })
})

describe('ModelUsageSchema', () => {
  test('validates token counts', () => {
    const result = ModelUsageSchema.parse({ inputTokens: 1500, outputTokens: 300 })
    expect(result.inputTokens).toBe(1500)
    expect(result.outputTokens).toBe(300)
  })
})

describe('AgentConfigSchema', () => {
  test('provides defaults for maxIterations and temperature', () => {
    const result = AgentConfigSchema.parse({})
    expect(result.maxIterations).toBe(50)
    expect(result.temperature).toBe(0)
  })

  test('accepts custom values', () => {
    const result = AgentConfigSchema.parse({
      systemPrompt: 'You are a helpful agent',
      maxIterations: 100,
      temperature: 0.7,
    })
    expect(result.systemPrompt).toBe('You are a helpful agent')
    expect(result.maxIterations).toBe(100)
    expect(result.temperature).toBe(0.7)
  })
})

describe('RISK_TAG', () => {
  test('contains all expected tag values', () => {
    expect(RISK_TAG.workspace).toBe('workspace')
    expect(RISK_TAG.crosses_boundary).toBe('crosses_boundary')
    expect(RISK_TAG.inbound).toBe('inbound')
    expect(RISK_TAG.outbound).toBe('outbound')
    expect(RISK_TAG.irreversible).toBe('irreversible')
    expect(RISK_TAG.external_audience).toBe('external_audience')
  })

  test('has exactly 6 tags', () => {
    expect(Object.keys(RISK_TAG)).toHaveLength(6)
  })
})
