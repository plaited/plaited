import { describe, expect, test } from 'bun:test'
import type { CaptureResult } from '../../schemas.ts'
import { formatMarkdown, formatSummary } from '../summarize.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createBasicResult = (overrides?: Partial<CaptureResult>): CaptureResult => ({
  id: 'test-001',
  input: 'What is 2+2?',
  output: 'The answer is 4.',
  trajectory: [
    { type: 'thought', content: 'Let me think about this...', timestamp: 0 },
    { type: 'message', content: 'The answer is 4.', timestamp: 100 },
  ],
  metadata: { category: 'math', agent: 'test-agent' },
  timing: { start: 1000, end: 2000, sessionCreation: 0, total: 1000 },
  toolErrors: false,
  ...overrides,
})

const createResultWithToolCalls = (): CaptureResult => ({
  id: 'test-002',
  input: 'Read and summarize file.txt',
  output: 'File contains important data.',
  trajectory: [
    { type: 'thought', content: 'I will read the file first.', timestamp: 0 },
    {
      type: 'tool_call',
      name: 'Read',
      status: 'completed',
      input: { file_path: '/path/to/file.txt' },
      output: 'file contents here',
      duration: 50,
      timestamp: 100,
    },
    {
      type: 'tool_call',
      name: 'Write',
      status: 'completed',
      input: { file_path: '/output.md', content: 'Summary here' },
      duration: 30,
      timestamp: 200,
    },
    { type: 'message', content: 'File contains important data.', timestamp: 300 },
  ],
  metadata: { agent: 'test-agent' },
  timing: { start: 1000, end: 1500, sessionCreation: 0, total: 500 },
  toolErrors: false,
})

// ============================================================================
// formatSummary
// ============================================================================

describe('formatSummary', () => {
  test('extracts id, input, and output', () => {
    const result = createBasicResult()
    const summary = formatSummary(result)

    expect(summary.id).toBe('test-001')
    expect(summary.input).toBe('What is 2+2?')
    expect(summary.output).toBe('The answer is 4.')
  })

  test('extracts tool call names', () => {
    const result = createResultWithToolCalls()
    const summary = formatSummary(result)

    expect(summary.toolCalls).toEqual(['Read', 'Write'])
  })

  test('calculates duration from timing', () => {
    const result = createBasicResult()
    const summary = formatSummary(result)

    expect(summary.duration).toBe(1000) // 2000 - 1000
  })

  test('handles empty trajectory', () => {
    const result = createBasicResult({ trajectory: [] })
    const summary = formatSummary(result)

    expect(summary.toolCalls).toEqual([])
  })

  test('filters only tool_call steps for toolCalls list', () => {
    const result = createBasicResult()
    const summary = formatSummary(result)

    // trajectory has thought and message, but no tool_call
    expect(summary.toolCalls).toEqual([])
  })

  test('handles trajectory with only messages', () => {
    const result = createBasicResult({
      trajectory: [
        { type: 'message', content: 'First message', timestamp: 0 },
        { type: 'message', content: 'Second message', timestamp: 100 },
      ],
    })
    const summary = formatSummary(result)

    expect(summary.toolCalls).toEqual([])
  })

  test('preserves original input/output exactly', () => {
    const result = createBasicResult({
      input: 'Input with\nnewlines and "quotes"',
      output: 'Output with\ttabs',
    })
    const summary = formatSummary(result)

    expect(summary.input).toBe('Input with\nnewlines and "quotes"')
    expect(summary.output).toBe('Output with\ttabs')
  })
})

// ============================================================================
// formatMarkdown
// ============================================================================

describe('formatMarkdown', () => {
  test('includes evaluation record header with id', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('## Evaluation Record: test-001')
  })

  test('includes input field', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Input:** What is 2+2?')
  })

  test('includes trajectory section', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Trajectory:**')
  })

  test('formats thought steps with truncation', () => {
    const result = createBasicResult({
      trajectory: [
        { type: 'thought', content: 'Short thought', timestamp: 0 },
        { type: 'thought', content: 'A'.repeat(150), timestamp: 100 },
      ],
    })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('[THOUGHT] Short thought')
    expect(markdown).toContain(`[THOUGHT] ${'A'.repeat(100)}...`)
  })

  test('formats tool calls with status and duration', () => {
    const result = createResultWithToolCalls()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('[TOOL:Read] -> completed (50ms)')
    expect(markdown).toContain('[TOOL:Write] -> completed (30ms)')
  })

  test('includes file path for tool calls', () => {
    const result = createResultWithToolCalls()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('File: /path/to/file.txt')
    expect(markdown).toContain('File: /output.md')
  })

  test('includes step IDs for reference', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('[→test-001-step-1]')
    expect(markdown).toContain('[→test-001-step-2]')
  })

  test('formats plan steps', () => {
    const result = createBasicResult({
      trajectory: [
        {
          type: 'plan',
          entries: [
            { content: 'Step 1', status: 'completed' },
            { content: 'Step 2', status: 'in_progress' },
          ],
          timestamp: 0,
        },
      ],
    })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('[PLAN]')
    expect(markdown).toContain('Step 1: completed')
    expect(markdown).toContain('Step 2: in_progress')
  })

  test('truncates long plan summaries', () => {
    const result = createBasicResult({
      trajectory: [
        {
          type: 'plan',
          entries: [
            { content: 'A very long step description that goes on and on', status: 'completed' },
            { content: 'Another very long step description', status: 'pending' },
            { content: 'Yet another step', status: 'pending' },
          ],
          timestamp: 0,
        },
      ],
    })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('...')
  })

  test('formats message steps', () => {
    const result = createBasicResult({
      trajectory: [{ type: 'message', content: 'Here is my response to your question.', timestamp: 0 }],
    })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('[MESSAGE] Here is my response')
  })

  test('includes output preview', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Output:** The answer is 4.')
  })

  test('truncates long output', () => {
    const result = createBasicResult({
      output: 'X'.repeat(300),
    })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain(`${'X'.repeat(200)}...`)
  })

  test('includes metadata', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Metadata:**')
    expect(markdown).toContain('category=math')
    expect(markdown).toContain('agent=test-agent')
  })

  test('includes tool errors status', () => {
    const result = createBasicResult({ toolErrors: true })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Tool Errors:** true')
  })

  test('includes duration', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Duration:** 1000ms')
  })

  test('includes score when present', () => {
    const result = createBasicResult({
      score: {
        pass: true,
        score: 0.95,
        reasoning: 'Correct answer provided',
      },
    })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Score:** PASS (0.95)')
    expect(markdown).toContain('**Reasoning:** Correct answer provided')
  })

  test('handles failed score', () => {
    const result = createBasicResult({
      score: {
        pass: false,
        score: 0.2,
        reasoning: 'Incorrect answer',
      },
    })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Score:** FAIL (0.2)')
  })

  test('includes content preview with syntax highlighting', () => {
    const result: CaptureResult = {
      id: 'test-003',
      input: 'Write a function',
      output: 'Done',
      trajectory: [
        {
          type: 'tool_call',
          name: 'Write',
          status: 'completed',
          input: {
            file_path: '/src/utils.ts',
            content: 'export const add = (a: number, b: number) => a + b;',
          },
          duration: 20,
          timestamp: 0,
        },
      ],
      metadata: { agent: 'test' },
      timing: { start: 0, end: 100, sessionCreation: 0, total: 100 },
      toolErrors: false,
    }
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('```ts')
    expect(markdown).toContain('export const add')
  })

  test('ends with horizontal rule separator', () => {
    const result = createBasicResult()
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('---')
  })

  test('handles empty trajectory', () => {
    const result = createBasicResult({ trajectory: [] })
    const markdown = formatMarkdown(result)

    expect(markdown).toContain('**Trajectory:**')
    expect(markdown).toContain('**Output:**')
  })
})
