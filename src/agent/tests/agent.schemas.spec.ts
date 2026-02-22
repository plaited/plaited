import { describe, expect, test } from 'bun:test'
import {
  MessageStepSchema as EvalMessageStepSchema,
  PlanStepSchema as EvalPlanStepSchema,
  ThoughtStepSchema as EvalThoughtStepSchema,
  ToolCallStepSchema as EvalToolCallStepSchema,
  TrajectoryStepSchema as EvalTrajectoryStepSchema,
} from '@plaited/agent-eval-harness/schemas'
import {
  AgentConfigSchema,
  AgentPlanSchema,
  AgentPlanStepSchema,
  AgentToolCallSchema,
  GateDecisionSchema,
  MessageStepSchema,
  PlanStepSchema,
  ThoughtStepSchema,
  ToolCallStepSchema,
  ToolResultSchema,
  TrajectoryStepSchema,
} from '../agent.schemas.ts'

// ============================================================================
// TrajectoryStep Schemas
// ============================================================================

describe('ThoughtStepSchema', () => {
  test('accepts valid thought step', () => {
    const result = ThoughtStepSchema.safeParse({
      type: 'thought',
      content: 'I need to read the file first',
      timestamp: Date.now(),
    })
    expect(result.success).toBe(true)
  })

  test('accepts thought step with stepId', () => {
    const result = ThoughtStepSchema.safeParse({
      type: 'thought',
      content: 'reasoning',
      timestamp: 1000,
      stepId: 'step-1',
    })
    expect(result.success).toBe(true)
  })

  test('rejects wrong type discriminator', () => {
    const result = ThoughtStepSchema.safeParse({
      type: 'message',
      content: 'wrong type',
      timestamp: 1000,
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing content', () => {
    const result = ThoughtStepSchema.safeParse({
      type: 'thought',
      timestamp: 1000,
    })
    expect(result.success).toBe(false)
  })
})

describe('MessageStepSchema', () => {
  test('accepts valid message step', () => {
    const result = MessageStepSchema.safeParse({
      type: 'message',
      content: 'Here is the answer',
      timestamp: Date.now(),
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing timestamp', () => {
    const result = MessageStepSchema.safeParse({
      type: 'message',
      content: 'no timestamp',
    })
    expect(result.success).toBe(false)
  })
})

describe('ToolCallStepSchema', () => {
  test('accepts valid tool call step with all fields', () => {
    const result = ToolCallStepSchema.safeParse({
      type: 'tool_call',
      name: 'read_file',
      status: 'completed',
      input: { path: '/foo.ts' },
      output: 'file contents',
      duration: 150,
      timestamp: Date.now(),
      stepId: 'tc-1',
    })
    expect(result.success).toBe(true)
  })

  test('accepts tool call step with minimal fields', () => {
    const result = ToolCallStepSchema.safeParse({
      type: 'tool_call',
      name: 'list_files',
      status: 'pending',
      timestamp: 1000,
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing name', () => {
    const result = ToolCallStepSchema.safeParse({
      type: 'tool_call',
      status: 'completed',
      timestamp: 1000,
    })
    expect(result.success).toBe(false)
  })
})

describe('PlanStepSchema', () => {
  test('accepts valid plan step', () => {
    const result = PlanStepSchema.safeParse({
      type: 'plan',
      entries: [{ id: 'step-1', intent: 'read file' }],
      timestamp: Date.now(),
    })
    expect(result.success).toBe(true)
  })

  test('accepts plan step with empty entries', () => {
    const result = PlanStepSchema.safeParse({
      type: 'plan',
      entries: [],
      timestamp: 1000,
    })
    expect(result.success).toBe(true)
  })
})

describe('TrajectoryStepSchema', () => {
  test('discriminates thought', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'thought',
      content: 'thinking...',
      timestamp: 1000,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.type).toBe('thought')
  })

  test('discriminates message', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'message',
      content: 'hello',
      timestamp: 1000,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.type).toBe('message')
  })

  test('discriminates tool_call', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'tool_call',
      name: 'test',
      status: 'completed',
      timestamp: 1000,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.type).toBe('tool_call')
  })

  test('discriminates plan', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'plan',
      entries: [],
      timestamp: 1000,
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.type).toBe('plan')
  })

  test('rejects unknown type', () => {
    const result = TrajectoryStepSchema.safeParse({
      type: 'unknown',
      timestamp: 1000,
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// AgentToolCallSchema
// ============================================================================

describe('AgentToolCallSchema', () => {
  test('accepts valid tool call', () => {
    const result = AgentToolCallSchema.safeParse({
      id: 'call_123',
      name: 'read_file',
      arguments: { path: '/foo.ts' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts tool call with empty arguments', () => {
    const result = AgentToolCallSchema.safeParse({
      id: 'call_456',
      name: 'list_files',
      arguments: {},
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing id', () => {
    const result = AgentToolCallSchema.safeParse({
      name: 'read_file',
      arguments: {},
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing name', () => {
    const result = AgentToolCallSchema.safeParse({
      id: 'call_123',
      arguments: {},
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// AgentPlanSchema
// ============================================================================

describe('AgentPlanStepSchema', () => {
  test('accepts valid plan step', () => {
    const result = AgentPlanStepSchema.safeParse({
      id: 'step-1',
      intent: 'Read the configuration file',
      tools: ['read_file'],
    })
    expect(result.success).toBe(true)
  })

  test('accepts plan step with depends', () => {
    const result = AgentPlanStepSchema.safeParse({
      id: 'step-2',
      intent: 'Modify the config',
      tools: ['write_file'],
      depends: ['step-1'],
    })
    expect(result.success).toBe(true)
  })
})

describe('AgentPlanSchema', () => {
  test('accepts valid plan', () => {
    const result = AgentPlanSchema.safeParse({
      goal: 'Update the configuration',
      steps: [
        { id: 'step-1', intent: 'Read config', tools: ['read_file'] },
        { id: 'step-2', intent: 'Write config', tools: ['write_file'], depends: ['step-1'] },
      ],
    })
    expect(result.success).toBe(true)
  })

  test('rejects missing goal', () => {
    const result = AgentPlanSchema.safeParse({
      steps: [{ id: 's1', intent: 'do thing', tools: [] }],
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// ToolResultSchema
// ============================================================================

describe('ToolResultSchema', () => {
  test('accepts completed tool result', () => {
    const result = ToolResultSchema.safeParse({
      toolCallId: 'call_123',
      name: 'read_file',
      status: 'completed',
      output: 'file contents here',
      duration: 42,
    })
    expect(result.success).toBe(true)
  })

  test('accepts failed tool result', () => {
    const result = ToolResultSchema.safeParse({
      toolCallId: 'call_456',
      name: 'write_file',
      status: 'failed',
      error: 'Permission denied',
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid status', () => {
    const result = ToolResultSchema.safeParse({
      toolCallId: 'call_789',
      name: 'test',
      status: 'invalid_status',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// GateDecisionSchema
// ============================================================================

describe('GateDecisionSchema', () => {
  test('accepts approved decision', () => {
    const result = GateDecisionSchema.safeParse({
      approved: true,
      riskClass: 'read_only',
    })
    expect(result.success).toBe(true)
  })

  test('accepts rejected decision with reason', () => {
    const result = GateDecisionSchema.safeParse({
      approved: false,
      riskClass: 'high_ambiguity',
      reason: 'Tool could modify filesystem',
    })
    expect(result.success).toBe(true)
  })

  test('accepts minimal decision (approved only)', () => {
    const result = GateDecisionSchema.safeParse({
      approved: true,
    })
    expect(result.success).toBe(true)
  })

  test('rejects invalid risk class', () => {
    const result = GateDecisionSchema.safeParse({
      approved: true,
      riskClass: 'unknown_class',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// AgentConfigSchema
// ============================================================================

describe('AgentConfigSchema', () => {
  test('accepts full config', () => {
    const result = AgentConfigSchema.safeParse({
      model: 'qwen3-8b',
      baseUrl: 'http://localhost:8080',
      apiKey: 'sk-test',
      tools: [{ type: 'function', function: { name: 'read_file' } }],
      systemPrompt: 'You are a helpful assistant.',
      maxIterations: 10,
      temperature: 0.5,
    })
    expect(result.success).toBe(true)
  })

  test('applies maxIterations default', () => {
    const result = AgentConfigSchema.parse({
      model: 'test',
      baseUrl: 'http://test',
    })
    expect(result.maxIterations).toBe(50)
  })

  test('applies temperature default', () => {
    const result = AgentConfigSchema.parse({
      model: 'test',
      baseUrl: 'http://test',
    })
    expect(result.temperature).toBe(0)
  })

  test('allows overriding defaults', () => {
    const result = AgentConfigSchema.parse({
      model: 'test',
      baseUrl: 'http://test',
      maxIterations: 3,
      temperature: 0.7,
    })
    expect(result.maxIterations).toBe(3)
    expect(result.temperature).toBe(0.7)
  })

  test('rejects missing model', () => {
    const result = AgentConfigSchema.safeParse({
      baseUrl: 'http://test',
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing baseUrl', () => {
    const result = AgentConfigSchema.safeParse({
      model: 'test',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// Structural Compatibility with Eval Harness
// ============================================================================

describe('eval harness structural compatibility', () => {
  const now = Date.now()

  test('ThoughtStep is accepted by eval harness schema', () => {
    const step = ThoughtStepSchema.parse({ type: 'thought', content: 'thinking', timestamp: now })
    const evalResult = EvalThoughtStepSchema.safeParse(step)
    expect(evalResult.success).toBe(true)
  })

  test('MessageStep is accepted by eval harness schema', () => {
    const step = MessageStepSchema.parse({ type: 'message', content: 'hello', timestamp: now })
    const evalResult = EvalMessageStepSchema.safeParse(step)
    expect(evalResult.success).toBe(true)
  })

  test('ToolCallStep is accepted by eval harness schema', () => {
    const step = ToolCallStepSchema.parse({
      type: 'tool_call',
      name: 'read_file',
      status: 'completed',
      input: { path: '/foo' },
      output: 'contents',
      duration: 100,
      timestamp: now,
    })
    const evalResult = EvalToolCallStepSchema.safeParse(step)
    expect(evalResult.success).toBe(true)
  })

  test('PlanStep is accepted by eval harness schema', () => {
    const step = PlanStepSchema.parse({ type: 'plan', entries: [{ id: 's1' }], timestamp: now })
    const evalResult = EvalPlanStepSchema.safeParse(step)
    expect(evalResult.success).toBe(true)
  })

  test('all trajectory step types accepted by eval harness discriminated union', () => {
    const steps = [
      { type: 'thought' as const, content: 'think', timestamp: now },
      { type: 'message' as const, content: 'msg', timestamp: now },
      { type: 'tool_call' as const, name: 'test', status: 'completed', timestamp: now },
      { type: 'plan' as const, entries: [], timestamp: now },
    ]
    for (const step of steps) {
      const ours = TrajectoryStepSchema.safeParse(step)
      expect(ours.success).toBe(true)
      if (ours.success) {
        const theirs = EvalTrajectoryStepSchema.safeParse(ours.data)
        expect(theirs.success).toBe(true)
      }
    }
  })
})
