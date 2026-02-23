import { describe, expect, mock, test } from 'bun:test'
import type { AgentToolCall } from '../agent.schemas.ts'
import { buildStateTransitionPrompt, createSimulate, parseSimulationResponse } from '../agent.simulate.ts'
import type { ChatMessage, InferenceCall } from '../agent.types.ts'

// ============================================================================
// Test helpers
// ============================================================================

const makeToolCall = (overrides: Partial<AgentToolCall> = {}): AgentToolCall => ({
  id: 'tc-1',
  name: 'write_file',
  arguments: { path: '/app.ts', content: 'hello' },
  ...overrides,
})

const makePlan = () => ({
  goal: 'Refactor the config module',
  steps: [
    { id: 's1', intent: 'Read config', tools: ['read_file'] },
    { id: 's2', intent: 'Write config', tools: ['write_file'] },
  ],
})

// ============================================================================
// buildStateTransitionPrompt
// ============================================================================

describe('buildStateTransitionPrompt', () => {
  test('builds system message with world model instructions', () => {
    const messages = buildStateTransitionPrompt({
      toolCall: makeToolCall(),
      history: [],
      plan: null,
    })

    const system = messages.find((m) => m.role === 'system')
    expect(system).toBeDefined()
    expect(system!.content).toContain('world model simulator')
    expect(system!.content).toContain('predict')
  })

  test('includes tool call details in user message', () => {
    const tc = makeToolCall({ name: 'bash', arguments: { command: 'ls -la' } })
    const messages = buildStateTransitionPrompt({ toolCall: tc, history: [], plan: null })

    const user = messages.find((m) => m.role === 'user')
    expect(user).toBeDefined()
    expect(user!.content).toContain('bash')
    expect(user!.content).toContain('ls -la')
  })

  test('includes plan context when plan provided', () => {
    const messages = buildStateTransitionPrompt({
      toolCall: makeToolCall(),
      history: [],
      plan: makePlan(),
    })

    const system = messages.find((m) => m.role === 'system')
    expect(system!.content).toContain('Refactor the config module')
    expect(system!.content).toContain('Read config')
  })

  test('omits plan context when plan is null', () => {
    const messages = buildStateTransitionPrompt({
      toolCall: makeToolCall(),
      history: [],
      plan: null,
    })

    const system = messages.find((m) => m.role === 'system')
    expect(system!.content).not.toContain('Current Plan')
  })

  test('includes recent history (last 6 entries)', () => {
    const history: ChatMessage[] = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `message-${i}`,
    }))

    const messages = buildStateTransitionPrompt({
      toolCall: makeToolCall(),
      history,
      plan: null,
    })

    // Should have: system + 6 history + user prompt = 8
    expect(messages).toHaveLength(8)
    // First history message should be the 5th (index 4) from original
    expect(messages[1]!.content).toBe('message-4')
  })

  test('handles empty history', () => {
    const messages = buildStateTransitionPrompt({
      toolCall: makeToolCall(),
      history: [],
      plan: null,
    })

    // system + user prompt only
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[1]!.role).toBe('user')
  })
})

// ============================================================================
// parseSimulationResponse
// ============================================================================

describe('parseSimulationResponse', () => {
  test('extracts content from response', () => {
    const result = parseSimulationResponse({
      choices: [{ message: { content: 'File will be written successfully.' } }],
    })
    expect(result).toBe('File will be written successfully.')
  })

  test('strips think tags from content', () => {
    const result = parseSimulationResponse({
      choices: [{ message: { content: '<think>Let me analyze this...</think>File will be created.' } }],
    })
    expect(result).toBe('File will be created.')
  })

  test('handles reasoning_content field (vLLM format)', () => {
    const result = parseSimulationResponse({
      choices: [
        {
          message: {
            reasoning_content: 'Internal thinking here',
            content: 'The command will output directory listing.',
          },
        },
      ],
    })
    // reasoning_content should be preferred, content preserved
    expect(result).toBe('The command will output directory listing.')
  })

  test('returns empty string for null content', () => {
    const result = parseSimulationResponse({
      choices: [{ message: { content: null } }],
    })
    expect(result).toBe('')
  })

  test('returns empty string for missing message', () => {
    const result = parseSimulationResponse({ choices: [] })
    expect(result).toBe('')
  })
})

// ============================================================================
// createSimulate
// ============================================================================

describe('createSimulate', () => {
  test('calls inference with correct messages', async () => {
    const mockInference = mock(async () => ({
      choices: [{ message: { content: 'Predicted: file created at /app.ts' } }],
    })) as unknown as InferenceCall

    const simulate = createSimulate({ inferenceCall: mockInference, model: 'test-model' })

    await simulate({ toolCall: makeToolCall(), history: [], plan: null })

    expect(mockInference).toHaveBeenCalledTimes(1)
    const call = (mockInference as ReturnType<typeof mock>).mock.calls[0]![0] as {
      model: string
      messages: ChatMessage[]
    }
    expect(call.model).toBe('test-model')
    expect(call.messages[0]!.role).toBe('system')
  })

  test('returns parsed prediction text', async () => {
    const mockInference: InferenceCall = async () => ({
      choices: [{ message: { content: 'The file will contain hello world.' } }],
    })

    const simulate = createSimulate({ inferenceCall: mockInference, model: 'test' })
    const prediction = await simulate({ toolCall: makeToolCall(), history: [], plan: null })

    expect(prediction).toBe('The file will contain hello world.')
  })

  test('does not include tools parameter', async () => {
    const mockInference = mock(async () => ({
      choices: [{ message: { content: 'prediction' } }],
    })) as unknown as InferenceCall

    const simulate = createSimulate({ inferenceCall: mockInference, model: 'test' })
    await simulate({ toolCall: makeToolCall(), history: [], plan: null })

    const call = (mockInference as ReturnType<typeof mock>).mock.calls[0]![0] as {
      tools?: unknown
    }
    expect(call.tools).toBeUndefined()
  })
})
