import { describe, expect, test } from 'bun:test'
import type { FunctionCall, StoryResult, ToolResult } from '../agent.types.ts'
import {
  createToolExecutions,
  type ExecutionTrace,
  extractIntent,
  generateTrajectoryFromTrace,
  type StoryInfo,
  type ToolExecution,
} from '../generate-trajectories.ts'

describe('extractIntent', () => {
  test('uses description when provided', () => {
    const story: StoryInfo = {
      exportName: 'PrimaryButton',
      filePath: 'button.stories.tsx',
      description: 'A button with primary styling',
    }

    expect(extractIntent(story)).toBe('A button with primary styling')
  })

  test('parses PascalCase export name', () => {
    const story: StoryInfo = {
      exportName: 'PrimaryButton',
      filePath: 'button.stories.tsx',
    }

    expect(extractIntent(story)).toBe('Create a primary button')
  })

  test('parses camelCase export name', () => {
    const story: StoryInfo = {
      exportName: 'iconButton',
      filePath: 'button.stories.tsx',
    }

    expect(extractIntent(story)).toBe('Create a icon button')
  })

  test('handles consecutive capitals', () => {
    const story: StoryInfo = {
      exportName: 'UIButton',
      filePath: 'button.stories.tsx',
    }

    expect(extractIntent(story)).toBe('Create a ui button')
  })

  test('handles complex names', () => {
    const story: StoryInfo = {
      exportName: 'IconButtonWithTooltip',
      filePath: 'button.stories.tsx',
    }

    expect(extractIntent(story)).toBe('Create a icon button with tooltip')
  })
})

describe('createToolExecutions', () => {
  test('creates tool executions from calls and results', () => {
    const calls: FunctionCall[] = [
      { name: 'writeTemplate', arguments: '{"path": "button.tsx"}' },
      { name: 'runStory', arguments: '{"path": "button.stories.tsx"}' },
    ]

    const results: ToolResult[] = [
      { success: true, data: { path: 'button.tsx' } },
      { success: true, data: { passed: true } },
    ]

    const executions = createToolExecutions(calls, results)

    expect(executions).toHaveLength(2)
    expect(executions[0]!.call).toEqual(calls[0]!)
    expect(executions[0]!.result).toEqual(results[0]!)
    expect(executions[0]!.id).toBe('call_0000')
    expect(executions[1]!.id).toBe('call_0001')
  })

  test('throws on mismatched lengths', () => {
    const calls: FunctionCall[] = [{ name: 'writeTemplate', arguments: '{}' }]
    const results: ToolResult[] = []

    expect(() => createToolExecutions(calls, results)).toThrow('Mismatched calls')
  })
})

describe('generateTrajectoryFromTrace', () => {
  const baseResult: StoryResult = {
    passed: true,
    totalAssertions: 1,
    passedAssertions: 1,
    a11yPassed: true,
    errors: [],
  }

  test('generates single-turn trajectory from legacy format', () => {
    const trace: ExecutionTrace = {
      intent: 'Create a button',
      toolSchemas: [
        {
          name: 'writeTemplate',
          description: 'Write a template file',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } },
          },
        },
      ],
      functionCalls: [{ name: 'writeTemplate', arguments: '{"path": "button.tsx"}' }],
      storyResult: baseResult,
    }

    const trajectory = generateTrajectoryFromTrace(trace)

    expect(trajectory.messages).toHaveLength(3)
    expect(trajectory.messages[0]!.role).toBe('system')
    expect(trajectory.messages[1]!.role).toBe('user')
    expect(trajectory.messages[1]!.content).toBe('Create a button')
    expect(trajectory.messages[2]!.role).toBe('assistant')
    expect(trajectory.reward).toBe(1.0)
  })

  test('generates multi-turn trajectory with tool results', () => {
    const executions: ToolExecution[] = [
      {
        call: { name: 'writeTemplate', arguments: '{"path": "button.tsx"}' },
        result: { success: true, data: { path: 'button.tsx' } },
        id: 'call_0001',
      },
      {
        call: { name: 'runStory', arguments: '{"path": "button.stories.tsx"}' },
        result: { success: true, data: { passed: true } },
        id: 'call_0002',
      },
    ]

    const trace: ExecutionTrace = {
      intent: 'Create a button and test it',
      toolSchemas: [],
      toolExecutions: executions,
      storyResult: baseResult,
    }

    const trajectory = generateTrajectoryFromTrace(trace)

    // system + user + (assistant + tool) * 2 = 6 messages
    expect(trajectory.messages).toHaveLength(6)

    // Check message sequence
    expect(trajectory.messages[0]!.role).toBe('system')
    expect(trajectory.messages[1]!.role).toBe('user')
    expect(trajectory.messages[2]!.role).toBe('assistant')
    expect(trajectory.messages[3]!.role).toBe('tool')
    expect(trajectory.messages[4]!.role).toBe('assistant')
    expect(trajectory.messages[5]!.role).toBe('tool')

    // Check tool message structure
    const toolMessage = trajectory.messages[3]!
    expect(toolMessage.role).toBe('tool')
    if (toolMessage.role === 'tool') {
      expect(toolMessage.tool_call_id).toBe('call_0001')
      expect(toolMessage.name).toBe('writeTemplate')
    }
  })

  test('uses custom system prompt when provided', () => {
    const trace: ExecutionTrace = {
      intent: 'Test intent',
      toolSchemas: [],
      functionCalls: [{ name: 'test', arguments: '{}' }],
      storyResult: baseResult,
      systemPrompt: 'Custom system prompt',
    }

    const trajectory = generateTrajectoryFromTrace(trace)

    expect(trajectory.messages[0]!.content).toBe('Custom system prompt')
  })

  test('handles empty function calls', () => {
    const trace: ExecutionTrace = {
      intent: 'No tools needed',
      toolSchemas: [],
      storyResult: baseResult,
    }

    const trajectory = generateTrajectoryFromTrace(trace)

    // Just system + user
    expect(trajectory.messages).toHaveLength(2)
  })

  test('prefers toolExecutions over functionCalls when both present', () => {
    const trace: ExecutionTrace = {
      intent: 'Test',
      toolSchemas: [],
      functionCalls: [{ name: 'legacy', arguments: '{}' }],
      toolExecutions: [
        {
          call: { name: 'modern', arguments: '{}' },
          result: { success: true },
          id: 'call_0001',
        },
      ],
      storyResult: baseResult,
    }

    const trajectory = generateTrajectoryFromTrace(trace)

    // Should have tool message from toolExecutions, not functionCalls
    const assistantContent = trajectory.messages[2]!.content
    expect(assistantContent).toContain('modern')
    expect(assistantContent).not.toContain('legacy')
  })
})
