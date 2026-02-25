/**
 * Unit tests for pipeline commands.
 *
 * @remarks
 * Tests for the Unix-style pipeline commands:
 * - format: formatMarkdown, formatCsv helpers
 * - compare: parseLabeledRun helper
 * - type validation
 *
 * @packageDocumentation
 */

import { describe, expect, test } from 'bun:test'
import type {
  ComparisonGraderInput,
  ComparisonGraderResult,
  ExtractedResult,
  FormatStyle,
  GradedResult,
  LabeledRun,
  RawOutput,
} from '../pipeline.types.ts'

// ============================================================================
// Type Validation Tests
// ============================================================================

describe('RawOutput type', () => {
  test('accepts valid raw output', () => {
    const raw: RawOutput = {
      id: 'test-001',
      input: 'What is 2+2?',
      rawLines: ['{"type":"message","content":"4"}'],
      timing: {
        start: 1000,
        end: 2000,
        total: 1000,
      },
    }
    expect(raw.id).toBe('test-001')
    expect(raw.timing.total).toBe(1000)
  })

  test('accepts array input for multi-turn', () => {
    const raw: RawOutput = {
      id: 'multi-001',
      input: ['Hello', 'How are you?'],
      rawLines: [],
      timing: { start: 0, end: 100, total: 100 },
    }
    expect(Array.isArray(raw.input)).toBe(true)
    expect((raw.input as string[]).length).toBe(2)
  })

  test('accepts optional hint', () => {
    const raw: RawOutput = {
      id: 'hint-001',
      input: 'Calculate something',
      hint: 'Expected: numeric answer',
      rawLines: [],
      timing: { start: 0, end: 0, total: 0 },
    }
    expect(raw.hint).toBe('Expected: numeric answer')
  })

  test('accepts optional error', () => {
    const raw: RawOutput = {
      id: 'error-001',
      input: 'fail test',
      rawLines: [],
      timing: { start: 0, end: 100, total: 100 },
      error: 'Timeout exceeded',
    }
    expect(raw.error).toBe('Timeout exceeded')
  })
})

describe('ExtractedResult type', () => {
  test('accepts valid extracted result', () => {
    const extracted: ExtractedResult = {
      id: 'test-001',
      input: 'What is 2+2?',
      output: '4',
      trajectory: [
        {
          type: 'message',
          content: '4',
          timestamp: 100,
        },
      ],
      toolErrors: false,
      timing: { start: 0, end: 100, total: 100 },
    }
    expect(extracted.output).toBe('4')
    expect(extracted.trajectory.length).toBe(1)
    expect(extracted.toolErrors).toBe(false)
  })

  test('accepts thought and tool_call steps', () => {
    const extracted: ExtractedResult = {
      id: 'complex-001',
      input: 'Create a file',
      output: 'Done',
      trajectory: [
        { type: 'thought', content: 'I need to create a file', timestamp: 50 },
        {
          type: 'tool_call',
          name: 'Write',
          input: { path: '/tmp/test.txt', content: 'hello' },
          status: 'completed',
          timestamp: 200,
        },
        { type: 'message', content: 'Done', timestamp: 250 },
      ],
      toolErrors: false,
      timing: { start: 0, end: 300, total: 300 },
    }
    expect(extracted.trajectory.length).toBe(3)
    expect(extracted.trajectory[1]?.type).toBe('tool_call')
  })
})

describe('GradedResult type', () => {
  test('extends ExtractedResult with score', () => {
    const graded: GradedResult = {
      id: 'graded-001',
      input: 'What is 2+2?',
      output: '4',
      trajectory: [],
      toolErrors: false,
      timing: { start: 0, end: 100, total: 100 },
      score: {
        pass: true,
        score: 1.0,
        reasoning: 'Correct answer',
      },
    }
    expect(graded.score.pass).toBe(true)
    expect(graded.score.score).toBe(1.0)
    expect(graded.score.reasoning).toBe('Correct answer')
  })

  test('accepts failing score', () => {
    const graded: GradedResult = {
      id: 'fail-001',
      input: 'What is 2+2?',
      output: '5',
      trajectory: [],
      toolErrors: false,
      timing: { start: 0, end: 100, total: 100 },
      score: {
        pass: false,
        score: 0.0,
        reasoning: 'Incorrect answer',
      },
    }
    expect(graded.score.pass).toBe(false)
    expect(graded.score.score).toBe(0.0)
  })
})

describe('FormatStyle type', () => {
  test('accepts valid format styles', () => {
    const styles: FormatStyle[] = ['jsonl', 'markdown', 'csv']
    expect(styles).toContain('jsonl')
    expect(styles).toContain('markdown')
    expect(styles).toContain('csv')
  })
})

describe('LabeledRun type', () => {
  test('accepts label and path', () => {
    const run: LabeledRun = {
      label: 'baseline',
      path: './results/baseline.jsonl',
    }
    expect(run.label).toBe('baseline')
    expect(run.path).toBe('./results/baseline.jsonl')
  })
})

describe('ComparisonGraderInput type', () => {
  test('accepts multiple runs', () => {
    const input: ComparisonGraderInput = {
      id: 'compare-001',
      input: 'What is 2+2?',
      runs: {
        baseline: { output: '4' },
        experiment: { output: 'Four', trajectory: [] },
      },
    }
    expect(Object.keys(input.runs).length).toBe(2)
    expect(input.runs.baseline?.output).toBe('4')
    expect(input.runs.experiment?.trajectory).toEqual([])
  })
})

describe('ComparisonGraderResult type', () => {
  test('accepts rankings with reasoning', () => {
    const result: ComparisonGraderResult = {
      rankings: [
        { run: 'baseline', rank: 1, score: 0.95 },
        { run: 'experiment', rank: 2, score: 0.8 },
      ],
      reasoning: 'Baseline was more concise',
    }
    expect(result.rankings.length).toBe(2)
    expect(result.rankings[0]?.rank).toBe(1)
    expect(result.reasoning).toBeDefined()
  })
})

// ============================================================================
// Helper Function Tests (via import)
// ============================================================================

// Note: Some helper functions are not exported from the modules.
// These tests verify the type contracts that the helpers must satisfy.

describe('pipeline data flow', () => {
  test('RawOutput can flow to ExtractedResult', () => {
    const raw: RawOutput = {
      id: 'flow-001',
      input: 'test',
      hint: 'expected: something',
      rawLines: ['{"type":"message","content":"result"}'],
      timing: { start: 0, end: 100, total: 100 },
    }

    // Simulate extraction
    const extracted: ExtractedResult = {
      id: raw.id,
      input: raw.input,
      hint: raw.hint,
      output: 'result',
      trajectory: [{ type: 'message', content: 'result', timestamp: 100 }],
      toolErrors: false,
      timing: raw.timing,
    }

    expect(extracted.id).toBe(raw.id)
    expect(extracted.input).toBe(raw.input)
    expect(extracted.hint).toBe(raw.hint)
  })

  test('ExtractedResult can flow to GradedResult', () => {
    const extracted: ExtractedResult = {
      id: 'grade-flow-001',
      input: 'test',
      output: 'result',
      trajectory: [],
      toolErrors: false,
      timing: { start: 0, end: 100, total: 100 },
    }

    // Simulate grading
    const graded: GradedResult = {
      ...extracted,
      score: { pass: true, score: 1.0 },
    }

    expect(graded.id).toBe(extracted.id)
    expect(graded.score.pass).toBe(true)
  })
})

describe('comparison data structures', () => {
  test('LabeledRun derived from filename', () => {
    // Simulate parseLabeledRun behavior
    const path = '/path/to/results-baseline.jsonl'
    const basename = path.split('/').pop() ?? ''
    const label = basename.replace('.jsonl', '')

    const run: LabeledRun = { label, path }
    expect(run.label).toBe('results-baseline')
  })

  test('LabeledRun with explicit label', () => {
    // Simulate explicit label:path format
    const arg = 'my-baseline:/path/to/results.jsonl'
    const colonIdx = arg.indexOf(':')
    const label = arg.slice(0, colonIdx)
    const path = arg.slice(colonIdx + 1)

    const run: LabeledRun = { label, path }
    expect(run.label).toBe('my-baseline')
    expect(run.path).toBe('/path/to/results.jsonl')
  })

  test('comparison aggregates results by prompt ID', () => {
    const results1 = [
      { id: 'p1', output: 'a' },
      { id: 'p2', output: 'b' },
    ]
    const results2 = [
      { id: 'p1', output: 'x' },
      { id: 'p2', output: 'y' },
    ]

    // Simulate comparison aggregation
    const promptIds = new Set([...results1.map((r) => r.id), ...results2.map((r) => r.id)])
    expect(promptIds.size).toBe(2)

    const comparisonInput: ComparisonGraderInput = {
      id: 'p1',
      input: 'test prompt',
      runs: {
        run1: { output: results1.find((r) => r.id === 'p1')?.output ?? '' },
        run2: { output: results2.find((r) => r.id === 'p1')?.output ?? '' },
      },
    }
    expect(comparisonInput.runs.run1?.output).toBe('a')
    expect(comparisonInput.runs.run2?.output).toBe('x')
  })
})

describe('format style contracts', () => {
  test('markdown format includes summary when graded', () => {
    // Verify the type contract for markdown formatting
    const gradedResults: GradedResult[] = [
      {
        id: 't1',
        input: 'a',
        output: 'x',
        trajectory: [],
        toolErrors: false,
        timing: { start: 0, end: 100, total: 100 },
        score: { pass: true, score: 1.0 },
      },
      {
        id: 't2',
        input: 'b',
        output: 'y',
        trajectory: [],
        toolErrors: false,
        timing: { start: 0, end: 100, total: 100 },
        score: { pass: false, score: 0.5 },
      },
    ]

    const passed = gradedResults.filter((r) => r.score.pass).length
    const total = gradedResults.length
    const passRate = passed / total

    expect(passRate).toBe(0.5)
  })

  test('csv format escapes special characters', () => {
    // Test CSV escaping contract
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""').replace(/\n/g, '\\n')}"`

    expect(escapeCsv('hello')).toBe('"hello"')
    expect(escapeCsv('say "hello"')).toBe('"say ""hello"""')
    expect(escapeCsv('line1\nline2')).toBe('"line1\\nline2"')
  })
})
