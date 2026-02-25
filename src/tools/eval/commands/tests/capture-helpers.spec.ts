import { describe, expect, test } from 'bun:test'
import type { ParsedUpdate } from '../../headless/headless-output-parser.ts'
import type { TrajectoryStep } from '../../schemas.ts'
import {
  detectTrajectoryRichness,
  extractContent,
  extractFilePath,
  extractOutput,
  extractTrajectory,
  hasToolErrors,
  headTailPreview,
  loadPrompts,
} from '../capture.ts'

// ============================================================================
// loadPrompts
// ============================================================================

describe('loadPrompts', () => {
  test('parses valid JSONL file with string input', async () => {
    // Create a temporary test file
    const testPath = '/tmp/test-prompts-valid.jsonl'
    await Bun.write(
      testPath,
      `{"id": "test-1", "input": "What is 2+2?"}
{"id": "test-2", "input": "Hello world", "hint": "greeting"}`,
    )

    const prompts = await loadPrompts(testPath)

    expect(prompts).toHaveLength(2)
    expect(prompts[0]?.id).toBe('test-1')
    expect(prompts[0]?.input).toBe('What is 2+2?')
    expect(prompts[1]?.id).toBe('test-2')
    expect(prompts[1]?.hint).toBe('greeting')
  })

  test('parses multi-turn input (string array)', async () => {
    const testPath = '/tmp/test-prompts-multiturn.jsonl'
    await Bun.write(testPath, `{"id": "test-1", "input": ["Hello", "How are you?", "Goodbye"], "hint": "farewell"}`)

    const prompts = await loadPrompts(testPath)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.id).toBe('test-1')
    expect(Array.isArray(prompts[0]?.input)).toBe(true)
    expect(prompts[0]?.input).toEqual(['Hello', 'How are you?', 'Goodbye'])
    expect(prompts[0]?.hint).toBe('farewell')
  })

  test('parses prompts with metadata', async () => {
    const testPath = '/tmp/test-prompts-metadata.jsonl'
    await Bun.write(
      testPath,
      `{"id": "test-1", "input": "Test", "metadata": {"category": "math", "difficulty": "easy"}}`,
    )

    const prompts = await loadPrompts(testPath)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.metadata?.category).toBe('math')
    expect(prompts[0]?.metadata?.difficulty).toBe('easy')
  })

  test('throws on invalid JSON at specific line', async () => {
    const testPath = '/tmp/test-prompts-invalid.jsonl'
    await Bun.write(
      testPath,
      `{"id": "test-1", "input": "Valid"}
{invalid json here}
{"id": "test-3", "input": "Also valid"}`,
    )

    await expect(loadPrompts(testPath)).rejects.toThrow('Invalid prompt at line 2')
  })

  test('throws on missing required fields', async () => {
    const testPath = '/tmp/test-prompts-missing.jsonl'
    await Bun.write(testPath, `{"id": "test-1"}`)

    await expect(loadPrompts(testPath)).rejects.toThrow('Invalid prompt at line 1')
  })

  test('handles empty lines gracefully', async () => {
    const testPath = '/tmp/test-prompts-empty-lines.jsonl'
    await Bun.write(
      testPath,
      `{"id": "test-1", "input": "First"}

{"id": "test-2", "input": "Second"}
`,
    )

    const prompts = await loadPrompts(testPath)
    expect(prompts).toHaveLength(2)
  })
})

// ============================================================================
// extractTrajectory
// ============================================================================

describe('extractTrajectory', () => {
  const baseTime = 0

  test('extracts thoughts from thought type updates', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'thought',
        content: 'Let me think about this...',
        timestamp: 100,
        raw: { type: 'thought', text: 'Let me think about this...' },
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    expect(trajectory).toHaveLength(1)
    expect(trajectory[0]?.type).toBe('thought')
    const step = trajectory[0]!
    expect(step.type === 'thought' && step.content).toBe('Let me think about this...')
  })

  test('extracts messages from message type updates', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'message',
        content: 'Here is my answer.',
        timestamp: 200,
        raw: { type: 'message', text: 'Here is my answer.' },
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    expect(trajectory).toHaveLength(1)
    expect(trajectory[0]?.type).toBe('message')
    const step = trajectory[0]!
    expect(step.type === 'message' && step.content).toBe('Here is my answer.')
  })

  test('extracts tool calls with title and status', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'tool_call',
        title: 'Read',
        status: 'pending',
        timestamp: 300,
        raw: { tool: 'Read', input: { file_path: '/test.ts' } },
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    expect(trajectory).toHaveLength(1)
    expect(trajectory[0]?.type).toBe('tool_call')
    const step = trajectory[0]!
    expect(step.type === 'tool_call' && step.name).toBe('Read')
    expect(step.type === 'tool_call' && step.status).toBe('pending')
  })

  test('extracts plan type updates', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'plan',
        timestamp: 400,
        raw: {
          entries: [
            { content: 'Step 1', status: 'completed' },
            { content: 'Step 2', status: 'in_progress' },
          ],
        },
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    expect(trajectory).toHaveLength(1)
    expect(trajectory[0]?.type).toBe('plan')
    // Note: extractTrajectory creates plan entries from the update type
    // but doesn't extract entries from raw (they are captured via output parser mappings)
    const step = trajectory[0]!
    expect(step.type === 'plan').toBe(true)
  })

  test('handles empty updates', () => {
    const trajectory = extractTrajectory([], baseTime)
    expect(trajectory).toEqual([])
  })

  test('assigns timestamps relative to start time', () => {
    const startTime = 1000
    const updates: ParsedUpdate[] = [
      {
        type: 'message',
        content: 'First',
        timestamp: 1500,
        raw: { type: 'message', text: 'First' },
      },
      {
        type: 'message',
        content: 'Second',
        timestamp: 2000,
        raw: { type: 'message', text: 'Second' },
      },
    ]

    const trajectory = extractTrajectory(updates, startTime)

    expect(trajectory[0]?.timestamp).toBe(500)
    expect(trajectory[1]?.timestamp).toBe(1000)
  })

  test('handles updates without content for message/thought types', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'message',
        content: undefined, // No content - will have empty string
        timestamp: 100,
        raw: { type: 'message' },
      },
      {
        type: 'message',
        content: 'Has content',
        timestamp: 200,
        raw: { type: 'message', text: 'Has content' },
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    // Both messages are included - ones without content get empty string
    expect(trajectory).toHaveLength(2)
    expect(trajectory[0]?.type).toBe('message')
    expect(trajectory[1]?.type).toBe('message')
  })

  test('attaches input to new tool call from update', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'tool_call',
        title: 'Read',
        status: 'pending',
        input: { file_path: '/src/main.ts' },
        timestamp: 500,
        raw: {},
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    expect(trajectory).toHaveLength(1)
    const step = trajectory[0]!
    expect(step.type === 'tool_call' && step.input).toEqual({ file_path: '/src/main.ts' })
  })

  test('attaches output to tool call on completion', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'tool_call',
        title: 'Read',
        status: 'pending',
        input: { file_path: '/src/main.ts' },
        timestamp: 500,
        raw: {},
      },
      {
        type: 'tool_call',
        title: 'Read',
        status: 'completed',
        output: 'file contents here',
        timestamp: 800,
        raw: {},
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    expect(trajectory).toHaveLength(1)
    const step = trajectory[0]!
    expect(step.type).toBe('tool_call')
    if (step.type === 'tool_call') {
      expect(step.input).toEqual({ file_path: '/src/main.ts' })
      expect(step.output).toBe('file contents here')
      expect(step.status).toBe('completed')
      expect(step.duration).toBe(300)
    }
  })

  test('handles sequential same-named tool calls independently', () => {
    const updates: ParsedUpdate[] = [
      // First Read: pending → completed
      {
        type: 'tool_call',
        title: 'Read',
        status: 'pending',
        input: { file_path: '/src/a.ts' },
        timestamp: 100,
        raw: {},
      },
      {
        type: 'tool_call',
        title: 'Read',
        status: 'completed',
        output: 'contents of a.ts',
        timestamp: 300,
        raw: {},
      },
      // Second Read: pending → completed (same tool name, different args)
      {
        type: 'tool_call',
        title: 'Read',
        status: 'pending',
        input: { file_path: '/src/b.ts' },
        timestamp: 500,
        raw: {},
      },
      {
        type: 'tool_call',
        title: 'Read',
        status: 'completed',
        output: 'contents of b.ts',
        timestamp: 700,
        raw: {},
      },
    ]

    const trajectory = extractTrajectory(updates, baseTime)

    // Both calls should appear as separate trajectory steps
    const toolCalls = trajectory.filter((s) => s.type === 'tool_call')
    expect(toolCalls).toHaveLength(2)

    const first = toolCalls[0]!
    expect(first.type === 'tool_call' && first.input).toEqual({ file_path: '/src/a.ts' })
    expect(first.type === 'tool_call' && first.output).toBe('contents of a.ts')
    expect(first.type === 'tool_call' && first.status).toBe('completed')

    const second = toolCalls[1]!
    expect(second.type === 'tool_call' && second.input).toEqual({ file_path: '/src/b.ts' })
    expect(second.type === 'tool_call' && second.output).toBe('contents of b.ts')
    expect(second.type === 'tool_call' && second.status).toBe('completed')
  })
})

// ============================================================================
// extractOutput
// ============================================================================

describe('extractOutput', () => {
  test('joins message contents with newlines', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'message', content: 'First line', timestamp: 0 },
      { type: 'message', content: 'Second line', timestamp: 100 },
    ]

    expect(extractOutput(trajectory)).toBe('First line\nSecond line')
  })

  test('filters out non-message steps', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'thought', content: 'Thinking...', timestamp: 0 },
      { type: 'message', content: 'Answer', timestamp: 100 },
      { type: 'tool_call', name: 'Read', status: 'completed', timestamp: 200 },
      { type: 'message', content: 'Done', timestamp: 300 },
    ]

    expect(extractOutput(trajectory)).toBe('Answer\nDone')
  })

  test('returns empty string for empty trajectory', () => {
    expect(extractOutput([])).toBe('')
  })

  test('returns empty string when no messages', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'thought', content: 'Just thinking', timestamp: 0 },
      { type: 'tool_call', name: 'Read', status: 'completed', timestamp: 100 },
    ]

    expect(extractOutput(trajectory)).toBe('')
  })

  test('handles single message', () => {
    const trajectory: TrajectoryStep[] = [{ type: 'message', content: 'Only message', timestamp: 0 }]

    expect(extractOutput(trajectory)).toBe('Only message')
  })
})

// ============================================================================
// hasToolErrors
// ============================================================================

describe('hasToolErrors', () => {
  test('returns false when no tool calls', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'thought', content: 'Thinking', timestamp: 0 },
      { type: 'message', content: 'Done', timestamp: 100 },
    ]

    expect(hasToolErrors(trajectory)).toBe(false)
  })

  test('returns false when all tool calls succeeded', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'tool_call', name: 'Read', status: 'completed', timestamp: 0 },
      { type: 'tool_call', name: 'Write', status: 'completed', timestamp: 100 },
    ]

    expect(hasToolErrors(trajectory)).toBe(false)
  })

  test('returns true when any tool call failed', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'tool_call', name: 'Read', status: 'completed', timestamp: 0 },
      { type: 'tool_call', name: 'Write', status: 'failed', timestamp: 100 },
      { type: 'tool_call', name: 'Bash', status: 'completed', timestamp: 200 },
    ]

    expect(hasToolErrors(trajectory)).toBe(true)
  })

  test('returns false for empty trajectory', () => {
    expect(hasToolErrors([])).toBe(false)
  })

  test('returns true when only tool call failed', () => {
    const trajectory: TrajectoryStep[] = [{ type: 'tool_call', name: 'Bash', status: 'failed', timestamp: 0 }]

    expect(hasToolErrors(trajectory)).toBe(true)
  })
})

// ============================================================================
// headTailPreview
// ============================================================================

describe('headTailPreview', () => {
  test('returns full content when under limit', () => {
    const content = 'line1\nline2\nline3'
    expect(headTailPreview(content, 5, 5)).toBe(content)
  })

  test('truncates with omitted count for long content', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
    const content = lines.join('\n')

    const result = headTailPreview(content, 3, 3)

    expect(result).toContain('line1')
    expect(result).toContain('line2')
    expect(result).toContain('line3')
    expect(result).toContain('line18')
    expect(result).toContain('line19')
    expect(result).toContain('line20')
    expect(result).toContain('14 lines omitted')
  })

  test('respects custom head line count', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`)
    const content = lines.join('\n')

    const result = headTailPreview(content, 2, 2)

    expect(result).toContain('line1')
    expect(result).toContain('line2')
    expect(result).not.toContain('line3')
    expect(result).toContain('6 lines omitted')
  })

  test('respects custom tail line count', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`)
    const content = lines.join('\n')

    const result = headTailPreview(content, 1, 4)

    expect(result).toContain('line1')
    expect(result).toContain('line7')
    expect(result).toContain('line10')
    expect(result).toContain('5 lines omitted')
  })

  test('handles content exactly at boundary', () => {
    const content = 'line1\nline2\nline3\nline4\nline5\nline6'
    // 6 lines, head=3, tail=3 means no truncation needed
    expect(headTailPreview(content, 3, 3)).toBe(content)
  })

  test('handles single line content', () => {
    const content = 'single line'
    expect(headTailPreview(content, 3, 3)).toBe(content)
  })

  test('handles empty content', () => {
    expect(headTailPreview('', 3, 3)).toBe('')
  })
})

// ============================================================================
// extractFilePath
// ============================================================================

describe('extractFilePath', () => {
  test('extracts file_path field', () => {
    const input = { file_path: '/path/to/file.ts' }
    expect(extractFilePath(input)).toBe('/path/to/file.ts')
  })

  test('extracts path field as fallback', () => {
    const input = { path: '/another/path.js' }
    expect(extractFilePath(input)).toBe('/another/path.js')
  })

  test('prefers file_path over path', () => {
    const input = { file_path: '/preferred.ts', path: '/fallback.ts' }
    expect(extractFilePath(input)).toBe('/preferred.ts')
  })

  test('returns undefined for invalid input', () => {
    expect(extractFilePath(null)).toBeUndefined()
    expect(extractFilePath(undefined)).toBeUndefined()
    expect(extractFilePath('string')).toBeUndefined()
    expect(extractFilePath(123)).toBeUndefined()
  })

  test('returns undefined when no path fields present', () => {
    const input = { content: 'some content' }
    expect(extractFilePath(input)).toBeUndefined()
  })

  test('handles empty object', () => {
    expect(extractFilePath({})).toBeUndefined()
  })
})

// ============================================================================
// extractContent
// ============================================================================

describe('extractContent', () => {
  test('extracts content field', () => {
    const input = { content: 'const x = 1;' }
    expect(extractContent(input)).toBe('const x = 1;')
  })

  test('extracts new_string field as fallback', () => {
    const input = { new_string: 'const y = 2;' }
    expect(extractContent(input)).toBe('const y = 2;')
  })

  test('prefers content over new_string', () => {
    const input = { content: 'preferred', new_string: 'fallback' }
    expect(extractContent(input)).toBe('preferred')
  })

  test('returns undefined for invalid input', () => {
    expect(extractContent(null)).toBeUndefined()
    expect(extractContent(undefined)).toBeUndefined()
    expect(extractContent('string')).toBeUndefined()
    expect(extractContent(123)).toBeUndefined()
  })

  test('returns undefined when no content fields present', () => {
    const input = { file_path: '/some/path.ts' }
    expect(extractContent(input)).toBeUndefined()
  })

  test('handles empty object', () => {
    expect(extractContent({})).toBeUndefined()
  })

  test('handles multiline content', () => {
    const input = { content: 'line1\nline2\nline3' }
    expect(extractContent(input)).toBe('line1\nline2\nline3')
  })
})

// ============================================================================
// detectTrajectoryRichness
// ============================================================================

describe('detectTrajectoryRichness', () => {
  test('returns "full" when trajectory has thoughts', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'thought', content: 'Let me think...', timestamp: 0 },
      { type: 'message', content: 'Answer', timestamp: 100 },
    ]

    expect(detectTrajectoryRichness(trajectory)).toBe('full')
  })

  test('returns "full" when trajectory has tool calls', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'tool_call', name: 'Read', status: 'completed', timestamp: 0 },
      { type: 'message', content: 'Answer', timestamp: 100 },
    ]

    expect(detectTrajectoryRichness(trajectory)).toBe('full')
  })

  test('returns "full" when trajectory has plans', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'plan', entries: [{ content: 'Step 1', status: 'completed' }], timestamp: 0 },
      { type: 'message', content: 'Answer', timestamp: 100 },
    ]

    expect(detectTrajectoryRichness(trajectory)).toBe('full')
  })

  test('returns "messages-only" when trajectory only has messages', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'message', content: 'First', timestamp: 0 },
      { type: 'message', content: 'Second', timestamp: 100 },
    ]

    expect(detectTrajectoryRichness(trajectory)).toBe('messages-only')
  })

  test('returns "minimal" when trajectory is empty', () => {
    expect(detectTrajectoryRichness([])).toBe('minimal')
  })

  test('returns "full" when trajectory has mixed rich content', () => {
    const trajectory: TrajectoryStep[] = [
      { type: 'thought', content: 'Thinking...', timestamp: 0 },
      { type: 'tool_call', name: 'Read', status: 'completed', timestamp: 50 },
      { type: 'plan', entries: [], timestamp: 100 },
      { type: 'message', content: 'Done', timestamp: 150 },
    ]

    expect(detectTrajectoryRichness(trajectory)).toBe('full')
  })
})
