/**
 * Unit tests for core utilities.
 *
 * @remarks
 * Tests for shared utility functions in the core module:
 * - loading: loadPrompts, loadResults, loadJsonl
 * - trajectory: extractTrajectory, extractOutput, hasToolErrors
 * - output: writeOutput, logProgress, headTailPreview
 *
 * @packageDocumentation
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { unlink, writeFile } from 'node:fs/promises'
import type { ParsedUpdate } from '../../headless/headless-output-parser.ts'
import { loadJsonl, loadPrompts, loadResults } from '../loading.ts'
import { headTailPreview, resolvePath } from '../output.ts'
import { detectTrajectoryRichness, extractOutput, extractTrajectory, hasToolErrors } from '../trajectory.ts'

// ============================================================================
// Loading Tests
// ============================================================================

describe('loadJsonl', () => {
  const testFile = '/tmp/core-test-jsonl.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore if file doesn't exist
    }
  })

  test('loads and parses JSONL file', async () => {
    await writeFile(testFile, '{"a":1}\n{"a":2}\n{"a":3}')
    const results = await loadJsonl<{ a: number }>(testFile)
    expect(results.length).toBe(3)
    expect(results[0]?.a).toBe(1)
    expect(results[2]?.a).toBe(3)
  })

  test('skips empty lines', async () => {
    await writeFile(testFile, '{"a":1}\n\n{"a":2}\n')
    const results = await loadJsonl<{ a: number }>(testFile)
    expect(results.length).toBe(2)
  })

  test('handles empty file', async () => {
    await writeFile(testFile, '')
    const results = await loadJsonl(testFile)
    expect(results.length).toBe(0)
  })
})

describe('loadPrompts', () => {
  const testFile = '/tmp/core-test-prompts.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore
    }
  })

  test('loads valid prompts', async () => {
    await writeFile(testFile, '{"id":"p1","input":"hello"}\n{"id":"p2","input":"world"}')
    const prompts = await loadPrompts(testFile)
    expect(prompts.length).toBe(2)
    expect(prompts[0]?.id).toBe('p1')
    expect(prompts[0]?.input).toBe('hello')
  })

  test('loads multi-turn prompts', async () => {
    await writeFile(testFile, '{"id":"m1","input":["turn1","turn2"]}')
    const prompts = await loadPrompts(testFile)
    expect(prompts.length).toBe(1)
    expect(Array.isArray(prompts[0]?.input)).toBe(true)
    expect((prompts[0]?.input as string[]).length).toBe(2)
  })
})

describe('loadResults', () => {
  const testFile = '/tmp/core-test-results.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore
    }
  })

  test('loads capture results with full schema', async () => {
    const result = {
      id: 'r1',
      input: 'test',
      output: 'result',
      trajectory: [],
      metadata: {},
      toolErrors: false,
      timing: {
        start: 0,
        end: 100,
        total: 100,
        sessionCreation: 10,
      },
    }
    await writeFile(testFile, JSON.stringify(result))
    const results = await loadResults(testFile)
    expect(results.length).toBe(1)
    expect(results[0]?.id).toBe('r1')
    expect(results[0]?.output).toBe('result')
  })
})

// ============================================================================
// Trajectory Tests
// ============================================================================

describe('extractTrajectory', () => {
  const startTime = 1000

  test('extracts message updates', () => {
    const updates: ParsedUpdate[] = [{ type: 'message', content: 'Hello', timestamp: 1100, raw: {} }]
    const trajectory = extractTrajectory(updates, startTime)
    expect(trajectory.length).toBe(1)
    expect(trajectory[0]?.type).toBe('message')
    expect(trajectory[0]?.type === 'message' && trajectory[0]?.content).toBe('Hello')
  })

  test('extracts thought updates', () => {
    const updates: ParsedUpdate[] = [{ type: 'thought', content: 'Thinking...', timestamp: 1200, raw: {} }]
    const trajectory = extractTrajectory(updates, startTime)
    expect(trajectory.length).toBe(1)
    expect(trajectory[0]?.type).toBe('thought')
  })

  test('extracts tool_call with title', () => {
    const updates: ParsedUpdate[] = [
      {
        type: 'tool_call',
        title: 'Read',
        status: 'completed',
        timestamp: 1300,
        raw: {},
      },
    ]
    const trajectory = extractTrajectory(updates, startTime)
    expect(trajectory.length).toBe(1)
    expect(trajectory[0]?.type).toBe('tool_call')
    const step = trajectory[0]
    if (step?.type === 'tool_call') {
      expect(step.name).toBe('Read')
    }
  })

  test('handles empty updates', () => {
    const trajectory = extractTrajectory([], startTime)
    expect(trajectory.length).toBe(0)
  })
})

describe('extractOutput', () => {
  test('concatenates all message content', () => {
    const trajectory = [
      { type: 'thought' as const, content: 'Thinking', timestamp: 50 },
      { type: 'message' as const, content: 'First message', timestamp: 100 },
      { type: 'message' as const, content: 'Final answer', timestamp: 150 },
    ]
    const output = extractOutput(trajectory)
    // extractOutput joins all messages with newline
    expect(output).toBe('First message\nFinal answer')
  })

  test('returns empty string when no messages', () => {
    const trajectory = [{ type: 'thought' as const, content: 'Thinking only', timestamp: 50 }]
    const output = extractOutput(trajectory)
    expect(output).toBe('')
  })

  test('handles empty trajectory', () => {
    const output = extractOutput([])
    expect(output).toBe('')
  })
})

describe('hasToolErrors', () => {
  test('returns false for successful tool calls', () => {
    const trajectory = [
      {
        type: 'tool_call' as const,
        name: 'Read',
        status: 'completed',
        timestamp: 100,
      },
    ]
    expect(hasToolErrors(trajectory)).toBe(false)
  })

  test('returns true for failed status', () => {
    const trajectory = [
      {
        type: 'tool_call' as const,
        name: 'Read',
        status: 'failed',
        timestamp: 100,
      },
    ]
    // hasToolErrors checks for status === 'failed'
    expect(hasToolErrors(trajectory)).toBe(true)
  })

  test('returns false for error status (not failed)', () => {
    // The implementation checks for 'failed', not 'error'
    const trajectory = [
      {
        type: 'tool_call' as const,
        name: 'Read',
        status: 'error',
        timestamp: 100,
      },
    ]
    expect(hasToolErrors(trajectory)).toBe(false)
  })

  test('returns false for empty trajectory', () => {
    expect(hasToolErrors([])).toBe(false)
  })
})

describe('detectTrajectoryRichness', () => {
  test('returns full when has thoughts', () => {
    const trajectory = [
      { type: 'thought' as const, content: 'Let me think', timestamp: 50 },
      { type: 'message' as const, content: 'Done', timestamp: 150 },
    ]
    expect(detectTrajectoryRichness(trajectory)).toBe('full')
  })

  test('returns full when has tool_calls', () => {
    const trajectory = [
      {
        type: 'tool_call' as const,
        name: 'Read',
        status: 'completed',
        timestamp: 100,
      },
      { type: 'message' as const, content: 'Done', timestamp: 150 },
    ]
    // Any tool_call means 'full'
    expect(detectTrajectoryRichness(trajectory)).toBe('full')
  })

  test('returns messages-only when only messages', () => {
    const trajectory = [{ type: 'message' as const, content: 'Just a message', timestamp: 100 }]
    expect(detectTrajectoryRichness(trajectory)).toBe('messages-only')
  })

  test('returns minimal for empty trajectory', () => {
    // Empty trajectory returns 'minimal', not 'messages-only'
    expect(detectTrajectoryRichness([])).toBe('minimal')
  })
})

// ============================================================================
// Output Tests
// ============================================================================

describe('headTailPreview', () => {
  test('returns full content when short', () => {
    const content = 'line1\nline2\nline3'
    const preview = headTailPreview(content, 5, 3)
    expect(preview).toBe(content)
  })

  test('truncates long content with omission indicator', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`).join('\n')
    const preview = headTailPreview(lines, 3, 2)

    expect(preview).toContain('line1')
    expect(preview).toContain('line2')
    expect(preview).toContain('line3')
    // Actual format uses "// ... N lines omitted ..."
    expect(preview).toContain('// ... 15 lines omitted ...')
    expect(preview).toContain('line19')
    expect(preview).toContain('line20')
  })

  test('handles exact boundary', () => {
    const lines = 'line1\nline2\nline3\nline4\nline5'
    const preview = headTailPreview(lines, 3, 2)
    // 5 lines is exactly head(3) + tail(2), no truncation needed
    expect(preview).toBe(lines)
  })
})

describe('resolvePath', () => {
  test('resolves relative path from cwd', () => {
    const resolved = resolvePath('./test.txt')
    expect(resolved.endsWith('test.txt')).toBe(true)
    expect(resolved.startsWith('/')).toBe(true)
  })

  test('returns absolute path unchanged', () => {
    const path = '/absolute/path/file.txt'
    expect(resolvePath(path)).toBe(path)
  })
})
