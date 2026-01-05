import { describe, expect, test } from 'bun:test'
import type { FunctionCall, StoryResult, ToolResult } from '../agent.types.ts'
import {
  createToolExecutions,
  type ExecutionTrace,
  extractIntent,
  generateTrajectoryFromTrace,
  parseFunctionGemmaOutput,
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

describe('parseFunctionGemmaOutput', () => {
  test('parses single function call with string argument', () => {
    const output = '<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>}<end_function_call>'

    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('writeTemplate')
    expect(JSON.parse(calls[0]!.arguments)).toEqual({ path: 'button.tsx' })
  })

  test('parses multiple arguments', () => {
    const output =
      '<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>,content:<escape>export const Button = () => <button>Click</button><escape>}<end_function_call>'

    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    const args = JSON.parse(calls[0]!.arguments)
    expect(args.path).toBe('button.tsx')
    expect(args.content).toBe('export const Button = () => <button>Click</button>')
  })

  test('parses multiple consecutive function calls', () => {
    const output =
      '<start_function_call>call:writeTemplate{path:<escape>button.tsx<escape>}<end_function_call>' +
      '<start_function_call>call:writeStyles{path:<escape>button.css.ts<escape>}<end_function_call>'

    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(2)
    expect(calls[0]!.name).toBe('writeTemplate')
    expect(calls[1]!.name).toBe('writeStyles')
  })

  test('parses numeric values as numbers', () => {
    const output =
      '<start_function_call>call:test{count:<escape>42<escape>,rate:<escape>3.14<escape>}<end_function_call>'

    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.count).toBe(42)
    expect(args.rate).toBe(3.14)
  })

  test('parses boolean values', () => {
    const output =
      '<start_function_call>call:test{enabled:<escape>true<escape>,disabled:<escape>false<escape>}<end_function_call>'

    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.enabled).toBe(true)
    expect(args.disabled).toBe(false)
  })

  test('parses array values', () => {
    const output = '<start_function_call>call:test{items:<escape>["a","b","c"]<escape>}<end_function_call>'

    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.items).toEqual(['a', 'b', 'c'])
  })

  test('returns empty array for no matches', () => {
    const output = 'This is just regular text with no function calls'

    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(0)
  })

  test('returns empty array for empty string', () => {
    const calls = parseFunctionGemmaOutput('')

    expect(calls).toHaveLength(0)
  })

  test('handles function calls mixed with other text', () => {
    const output =
      'Some preamble text\n<start_function_call>call:writeTemplate{path:<escape>test.tsx<escape>}<end_function_call>\nSome trailing text'

    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('writeTemplate')
  })

  test('preserves newlines in escaped values', () => {
    const content = 'line1\nline2\nline3'
    const output = `<start_function_call>call:writeTemplate{content:<escape>${content}<escape>}<end_function_call>`

    const calls = parseFunctionGemmaOutput(output)

    const args = JSON.parse(calls[0]!.arguments)
    expect(args.content).toBe(content)
  })

  test('handles empty arguments', () => {
    const output = '<start_function_call>call:noArgs{}<end_function_call>'

    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('noArgs')
    expect(JSON.parse(calls[0]!.arguments)).toEqual({})
  })

  test('handles JSON object values with braces', () => {
    const jsonValue = { type: 'object', nested: { key: 'value' } }
    const output = `<start_function_call>call:test{config:<escape>${JSON.stringify(jsonValue)}<escape>}<end_function_call>`

    const calls = parseFunctionGemmaOutput(output)

    expect(calls).toHaveLength(1)
    const args = JSON.parse(calls[0]!.arguments)
    expect(args.config).toEqual(jsonValue)
  })

  test('roundtrip: format then parse recovers original calls', () => {
    // This tests that the format/parse are true inverses
    const originalCalls: FunctionCall[] = [
      {
        name: 'writeTemplate',
        arguments: JSON.stringify({
          path: 'src/button.tsx',
          content: 'export const Button = () => <button className="btn">Click</button>',
        }),
      },
      {
        name: 'writeStyles',
        arguments: JSON.stringify({
          path: 'src/button.css.ts',
          content: 'export const styles = createStyles({ btn: { color: "blue" } })',
        }),
      },
    ]

    // We need to access the internal formatFunctionCalls, so test via trajectory generation
    const trace: ExecutionTrace = {
      intent: 'Test roundtrip',
      toolSchemas: [],
      functionCalls: originalCalls,
      storyResult: {
        passed: true,
        totalAssertions: 1,
        passedAssertions: 1,
        a11yPassed: true,
        errors: [],
      },
    }

    const trajectory = generateTrajectoryFromTrace(trace)
    const assistantContent = trajectory.messages[2]!.content

    // Parse the formatted output back
    const parsedCalls = parseFunctionGemmaOutput(assistantContent)

    expect(parsedCalls).toHaveLength(2)
    expect(parsedCalls[0]!.name).toBe('writeTemplate')
    expect(parsedCalls[1]!.name).toBe('writeStyles')

    // Verify the parsed arguments match the originals
    expect(JSON.parse(parsedCalls[0]!.arguments)).toEqual(JSON.parse(originalCalls[0]!.arguments))
    expect(JSON.parse(parsedCalls[1]!.arguments)).toEqual(JSON.parse(originalCalls[1]!.arguments))
  })
})
