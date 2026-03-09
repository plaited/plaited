import { describe, expect, test } from 'bun:test'
import { createTrajectoryRecorder, parseModelResponse, TOOL_STATUS, toToolResult } from 'plaited'

describe('toToolResult', () => {
  const toolCall = { id: 'tc-1', name: 'read_file', arguments: { path: '/main.ts' } }

  test('passes through a valid ToolResult with duration', () => {
    const existing = {
      toolCallId: 'tc-1',
      name: 'read_file',
      status: TOOL_STATUS.completed,
      output: 'file contents',
    }
    const result = toToolResult(toolCall, existing, 42)
    expect(result.toolCallId).toBe('tc-1')
    expect(result.status).toBe('completed')
    expect(result.duration).toBe(42)
  })

  test('wraps an Error into a failed ToolResult', () => {
    const error = new Error('File not found')
    const result = toToolResult(toolCall, error, 10)
    expect(result.toolCallId).toBe('tc-1')
    expect(result.name).toBe('read_file')
    expect(result.status).toBe('failed')
    expect(result.error).toBe('File not found')
    expect(result.duration).toBe(10)
  })

  test('wraps a non-Error throwable into a failed ToolResult', () => {
    const result = toToolResult(toolCall, 'string error', 5)
    expect(result.status).toBe('failed')
    expect(result.error).toBe('string error')
  })
})

describe('parseModelResponse', () => {
  test('extracts message from content', () => {
    const result = parseModelResponse({
      choices: [{ message: { content: 'Hello world' } }],
    })
    expect(result.message).toBe('Hello world')
    expect(result.thinking).toBeNull()
    expect(result.toolCalls).toEqual([])
  })

  test('extracts thinking from reasoning_content field', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            content: 'The answer is 42',
            reasoning_content: 'Let me think about this...',
          },
        },
      ],
    })
    expect(result.thinking).toBe('Let me think about this...')
    expect(result.message).toBe('The answer is 42')
  })

  test('extracts thinking from <think> tags when reasoning_content absent', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            content: '<think>Internal reasoning here</think>The answer is 42',
          },
        },
      ],
    })
    expect(result.thinking).toBe('Internal reasoning here')
    expect(result.message).toBe('The answer is 42')
  })

  test('prefers reasoning_content over <think> tags', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            content: '<think>Tag thinking</think>Answer',
            reasoning_content: 'Field thinking',
          },
        },
      ],
    })
    expect(result.thinking).toBe('Field thinking')
    expect(result.message).toBe('<think>Tag thinking</think>Answer')
  })

  test('parses tool calls with JSON arguments', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'tc-1',
                function: {
                  name: 'read_file',
                  arguments: '{"path":"/main.ts"}',
                },
              },
            ],
          },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]!.id).toBe('tc-1')
    expect(result.toolCalls[0]!.name).toBe('read_file')
    expect(result.toolCalls[0]!.arguments).toEqual({ path: '/main.ts' })
  })

  test('handles malformed JSON arguments gracefully', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'tc-1',
                function: {
                  name: 'bash',
                  arguments: 'not valid json',
                },
              },
            ],
          },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]!.arguments).toEqual({ _raw: 'not valid json' })
  })

  test('handles object arguments (pre-parsed)', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'tc-1',
                function: {
                  name: 'write_file',
                  arguments: { path: '/out.ts', content: 'hello' },
                },
              },
            ],
          },
        },
      ],
    })
    expect(result.toolCalls[0]!.arguments).toEqual({ path: '/out.ts', content: 'hello' })
  })

  test('returns empty result for missing choices', () => {
    const result = parseModelResponse({ choices: [] })
    expect(result.thinking).toBeNull()
    expect(result.toolCalls).toEqual([])
    expect(result.message).toBeNull()
  })

  test('returns null message for whitespace-only content after think extraction', () => {
    const result = parseModelResponse({
      choices: [{ message: { content: '<think>reasoning</think>  ' } }],
    })
    expect(result.thinking).toBe('reasoning')
    expect(result.message).toBeNull()
  })

  test('skips tool calls missing id or function name', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              { function: { name: 'read_file', arguments: '{}' } },
              { id: 'tc-2' },
              { id: 'tc-3', function: { name: 'bash', arguments: '{}' } },
            ],
          },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]!.id).toBe('tc-3')
  })
})

describe('createTrajectoryRecorder', () => {
  test('records thought steps', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('Analyzing the code...')
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0]!.type).toBe('thought')
    expect((steps[0] as { content: string }).content).toBe('Analyzing the code...')
    expect(steps[0]!.timestamp).toBeGreaterThan(0)
  })

  test('records message steps', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addMessage('Here is the result')
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0]!.type).toBe('message')
  })

  test('records tool call steps', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addToolCall({
      name: 'read_file',
      status: 'completed',
      input: { path: '/main.ts' },
      output: 'contents',
      duration: 42,
    })
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0]!.type).toBe('tool_call')
    const step = steps[0] as { type: 'tool_call'; name: string; duration?: number }
    expect(step.name).toBe('read_file')
    expect(step.duration).toBe(42)
  })

  test('records plan steps', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addPlan([{ id: 's1', intent: 'Read files', tools: ['read_file'] }])
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0]!.type).toBe('plan')
  })

  test('includes optional stepId', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('test', 'step-1')
    recorder.addMessage('test', 'step-2')
    recorder.addToolCall({ name: 'bash', status: 'completed' }, 'step-3')
    recorder.addPlan([], 'step-4')
    const steps = recorder.getSteps()
    expect(steps[0]!.stepId).toBe('step-1')
    expect(steps[1]!.stepId).toBe('step-2')
    expect(steps[2]!.stepId).toBe('step-3')
    expect(steps[3]!.stepId).toBe('step-4')
  })

  test('getSteps returns a deep clone', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('test')
    const steps1 = recorder.getSteps()
    const steps2 = recorder.getSteps()
    expect(steps1).toEqual(steps2)
    expect(steps1).not.toBe(steps2)
  })

  test('reset clears all steps', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('first')
    recorder.addMessage('second')
    expect(recorder.getSteps()).toHaveLength(2)
    recorder.reset()
    expect(recorder.getSteps()).toHaveLength(0)
  })

  test('omits optional fields when not provided', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addToolCall({ name: 'bash', status: 'completed' })
    const steps = recorder.getSteps()
    const step = steps[0] as Record<string, unknown>
    expect(step.input).toBeUndefined()
    expect(step.output).toBeUndefined()
    expect(step.duration).toBeUndefined()
    expect(step.stepId).toBeUndefined()
  })
})
