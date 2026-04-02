import { describe, expect, test } from 'bun:test'

import { inferScaleGuess, judgePrompt } from '../training-prompts-judge.ts'

describe('training-prompts-judge', () => {
  test('flags legacy surface language', () => {
    const judgment = judgePrompt({
      bucket: 'test.jsonl',
      row: {
        id: 'legacy',
        prompt: 'Create a printable label maker for cassettes and VHS tapes.',
      },
    })

    expect(judgment.issues).toContain('legacy-surface')
    expect(judgment.scores.currentness).toBeLessThan(5)
  })

  test('flags prompts that read like planning advice instead of a module', () => {
    const judgment = judgePrompt({
      bucket: 'test.jsonl',
      row: {
        id: 'plan',
        prompt: 'Give me a migration plan that keeps the service running while I decide what to do.',
      },
    })

    expect(judgment.issues).toContain('non-module-job')
  })

  test('flags node-boundary confusion when modules and nodes are conflated', () => {
    const judgment = judgePrompt({
      bucket: 'test.jsonl',
      row: {
        id: 'boundary',
        prompt: 'Build a catalog for shared modules and connectable nodes across my network.',
      },
    })

    expect(judgment.issues).toContain('node-boundary-confusion')
  })

  test('infers scale from prompt surface', () => {
    expect(inferScaleGuess('Build a detail card with title and notes.')).toBe('S1')
    expect(inferScaleGuess('Create a list editor with sorting and filtering.')).toBe('S2')
    expect(inferScaleGuess('Build a household dashboard with shared tools.')).toBe('S3')
  })
})
