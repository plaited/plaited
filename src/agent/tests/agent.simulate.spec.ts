import { describe, expect, test } from 'bun:test'
import type { AgentToolCall, ChatMessage, Model } from 'plaited'
import { parsePrediction, STATE_TRANSITION_PROMPT, simulate } from '../simulate.ts'

// ============================================================================
// Mock Model factory
// ============================================================================

/** Creates a mock Model that yields canned text responses in sequence */
const createMockModel = (responses: string[]): Model => {
  let callIndex = 0
  return {
    reason: async function* ({ signal: _signal }) {
      const response = responses[callIndex++] ?? ''
      yield { type: 'text_delta' as const, content: response }
      yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
    },
  }
}

/** Creates a mock Model that yields an error */
const createErrorModel = (errorMsg: string): Model => ({
  reason: async function* () {
    yield { type: 'error' as const, error: errorMsg }
  },
})

/** Creates a mock Model that yields text in multiple chunks */
const createChunkedModel = (chunks: string[]): Model => ({
  reason: async function* () {
    for (const chunk of chunks) {
      yield { type: 'text_delta' as const, content: chunk }
    }
    yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
  },
})

// ============================================================================
// parsePrediction
// ============================================================================

describe('parsePrediction', () => {
  test('extracts predicted changes from formatted output', () => {
    const text = `PREDICTED OUTPUT:
File written successfully.

PREDICTED CHANGES:
- Created file /src/main.ts with 42 lines
- Modified package.json to add dependency`

    const result = parsePrediction(text)
    expect(result.predictedOutput).toBe(text)
    expect(result.predictedChanges).toEqual([
      'Created file /src/main.ts with 42 lines',
      'Modified package.json to add dependency',
    ])
  })

  test('returns empty changes when no PREDICTED CHANGES section', () => {
    const text = 'The command would print "hello world" to stdout.'
    const result = parsePrediction(text)
    expect(result.predictedOutput).toBe(text)
    expect(result.predictedChanges).toEqual([])
  })

  test('returns empty changes when PREDICTED CHANGES has no bullet items', () => {
    const text = `PREDICTED OUTPUT:
Success

PREDICTED CHANGES:
No changes expected.`

    const result = parsePrediction(text)
    expect(result.predictedChanges).toEqual([])
  })

  test('handles single change item', () => {
    const text = `PREDICTED OUTPUT:
Done

PREDICTED CHANGES:
- Deleted /tmp/test.txt`

    const result = parsePrediction(text)
    expect(result.predictedChanges).toEqual(['Deleted /tmp/test.txt'])
  })

  test('handles empty string', () => {
    const result = parsePrediction('')
    expect(result.predictedOutput).toBe('')
    expect(result.predictedChanges).toEqual([])
  })
})

// ============================================================================
// simulate
// ============================================================================

describe('simulate', () => {
  const toolCall: AgentToolCall = {
    id: 'tc-1',
    name: 'write_file',
    arguments: { path: '/src/main.ts', content: 'console.log("hello")' },
  }

  const history: ChatMessage[] = [
    { role: 'user', content: 'Create a hello world file' },
    { role: 'assistant', content: 'I will create the file for you.' },
  ]

  test('returns structured prediction from model', async () => {
    const predictionText = `PREDICTED OUTPUT:
File written successfully.

PREDICTED CHANGES:
- Created /src/main.ts with content: console.log("hello")`

    const model = createMockModel([predictionText])
    const result = await simulate({ toolCall, history, model })
    expect(result.predictedOutput).toBe(predictionText)
    expect(result.predictedChanges).toEqual(['Created /src/main.ts with content: console.log("hello")'])
  })

  test('collects text from multiple chunks', async () => {
    const model = createChunkedModel([
      'PREDICTED OUTPUT:\n',
      'Command succeeded.\n\n',
      'PREDICTED CHANGES:\n',
      '- File created\n',
      '- Dependencies installed',
    ])
    const result = await simulate({ toolCall, history, model })
    expect(result.predictedChanges).toEqual(['File created', 'Dependencies installed'])
  })

  test('propagates model errors', async () => {
    const model = createErrorModel('Inference timeout')
    await expect(simulate({ toolCall, history, model })).rejects.toThrow('Inference timeout')
  })

  test('passes conversation history in messages', async () => {
    let capturedMessages: ChatMessage[] = []
    const model: Model = {
      reason: async function* ({ messages, signal: _signal }) {
        capturedMessages = messages
        yield { type: 'text_delta' as const, content: 'prediction' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    await simulate({ toolCall, history, model })

    // System prompt + history (2 messages) + user prompt with tool call
    expect(capturedMessages).toHaveLength(4)
    expect(capturedMessages[0]!.role).toBe('system')
    expect(capturedMessages[0]!.content).toBe(STATE_TRANSITION_PROMPT)
    expect(capturedMessages[1]!.role).toBe('user')
    expect(capturedMessages[2]!.role).toBe('assistant')
    expect(capturedMessages[3]!.role).toBe('user')
    expect(capturedMessages[3]!.content).toContain('write_file')
    expect(capturedMessages[3]!.content).toContain('/src/main.ts')
  })

  test('uses temperature 0 for deterministic prediction', async () => {
    let capturedTemp: number | undefined
    const model: Model = {
      reason: async function* ({ temperature, signal: _signal }) {
        capturedTemp = temperature
        yield { type: 'text_delta' as const, content: 'prediction' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    await simulate({ toolCall, history, model })
    expect(capturedTemp).toBe(0)
  })

  test('respects abort signal', async () => {
    const controller = new AbortController()
    controller.abort()

    const model = createMockModel(['should not reach this'])
    await expect(simulate({ toolCall, history, model, signal: controller.signal })).rejects.toThrow()
  })

  test('handles empty history', async () => {
    const model = createMockModel(['PREDICTED OUTPUT:\nSuccess'])
    const result = await simulate({ toolCall, history: [], model })
    expect(result.predictedOutput).toBe('PREDICTED OUTPUT:\nSuccess')
  })

  test('formats tool call arguments as JSON in prompt', async () => {
    let capturedMessages: ChatMessage[] = []
    const model: Model = {
      reason: async function* ({ messages, signal: _signal }) {
        capturedMessages = messages
        yield { type: 'text_delta' as const, content: 'ok' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    const tc: AgentToolCall = {
      id: 'tc-2',
      name: 'bash',
      arguments: { command: 'ls -la' },
    }
    await simulate({ toolCall: tc, history: [], model })

    const lastMsg = capturedMessages[capturedMessages.length - 1]!
    expect(lastMsg.content).toContain('Tool: bash')
    expect(lastMsg.content).toContain('"command": "ls -la"')
  })
})
