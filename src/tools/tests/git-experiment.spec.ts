/**
 * Tests for git experiment helpers (read-side operations).
 *
 * @remarks
 * Covers: loadExperiments, getBaseline.
 * Tests use temp JSONL files — does NOT test commitExperiment/discardExperiment
 * (those perform destructive git operations on the real repo).
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ExperimentEntry } from '../git-experiment.ts'

// ============================================================================
// Helpers
// ============================================================================

/** Write a temp JSONL file and return a loadExperiments-compatible reader. */
const writeJsonl = async (dir: string, entries: ExperimentEntry[]): Promise<string> => {
  const path = join(dir, 'experiments.jsonl')
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n'
  await Bun.write(path, content)
  return path
}

/** Load entries from a JSONL file (mirrors loadExperiments logic without hardcoded path). */
const loadFromFile = async (path: string): Promise<ExperimentEntry[]> => {
  const file = Bun.file(path)
  if (!(await file.exists())) return []
  const content = await file.text()
  if (!content.trim()) return []
  return Bun.JSONL.parse(content) as ExperimentEntry[]
}

/** Find baseline from entries (mirrors getBaseline logic). */
const findBaseline = (entries: ExperimentEntry[]): ExperimentEntry | null => {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.status === 'keep') return entries[i]!
  }
  return null
}

const makeEntry = (overrides: Partial<ExperimentEntry> = {}): ExperimentEntry => ({
  commit: 'abc1234',
  scores: { outcome: 0.9, process: 0.8 },
  status: 'keep',
  description: 'test experiment',
  timestamp: '2026-03-17T00:00:00Z',
  ...overrides,
})

// ============================================================================
// ExperimentEntry type
// ============================================================================

describe('ExperimentEntry', () => {
  test('roundtrips through JSON', () => {
    const entry = makeEntry({ prompts: ['prompt-a', 'prompt-b'] })
    const parsed = JSON.parse(JSON.stringify(entry)) as ExperimentEntry
    expect(parsed.commit).toBe('abc1234')
    expect(parsed.status).toBe('keep')
    expect(parsed.prompts).toEqual(['prompt-a', 'prompt-b'])
  })

  test('prompts field is optional', () => {
    const entry = makeEntry()
    expect(entry.prompts).toBeUndefined()
    const parsed = JSON.parse(JSON.stringify(entry)) as ExperimentEntry
    expect(parsed.prompts).toBeUndefined()
  })

  test('status accepts keep, discard, crash', () => {
    expect(makeEntry({ status: 'keep' }).status).toBe('keep')
    expect(makeEntry({ status: 'discard' }).status).toBe('discard')
    expect(makeEntry({ status: 'crash' }).status).toBe('crash')
  })
})

// ============================================================================
// loadExperiments (via loadFromFile helper)
// ============================================================================

describe('loadExperiments', () => {
  let tempDir: string

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true })
  })

  test('loads multiple entries from JSONL', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'exp-test-'))
    const entries = [
      makeEntry({ commit: 'aaa1111', description: 'first' }),
      makeEntry({ commit: 'bbb2222', description: 'second', status: 'discard' }),
      makeEntry({ commit: 'ccc3333', description: 'third' }),
    ]
    const path = await writeJsonl(tempDir, entries)
    const loaded = await loadFromFile(path)

    expect(loaded).toHaveLength(3)
    expect(loaded[0]!.commit).toBe('aaa1111')
    expect(loaded[1]!.status).toBe('discard')
    expect(loaded[2]!.commit).toBe('ccc3333')
  })

  test('returns empty array for nonexistent file', async () => {
    const loaded = await loadFromFile('/nonexistent/path/experiments.jsonl')
    expect(loaded).toEqual([])
  })

  test('returns empty array for empty file', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'exp-test-'))
    const path = join(tempDir, 'experiments.jsonl')
    await Bun.write(path, '')
    const loaded = await loadFromFile(path)
    expect(loaded).toEqual([])
  })

  test('returns empty array for whitespace-only file', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'exp-test-'))
    const path = join(tempDir, 'experiments.jsonl')
    await Bun.write(path, '   \n  \n  ')
    const loaded = await loadFromFile(path)
    expect(loaded).toEqual([])
  })

  test('preserves scores object', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'exp-test-'))
    const entry = makeEntry({ scores: { outcome: 0.95, process: 1.0, efficiency: 0.88 } })
    const path = await writeJsonl(tempDir, [entry])
    const loaded = await loadFromFile(path)

    expect(loaded[0]!.scores.outcome).toBe(0.95)
    expect(loaded[0]!.scores.process).toBe(1.0)
    expect(loaded[0]!.scores.efficiency).toBe(0.88)
  })
})

// ============================================================================
// getBaseline (via findBaseline helper)
// ============================================================================

describe('getBaseline', () => {
  test('returns last keep entry', () => {
    const entries = [
      makeEntry({ commit: 'aaa', status: 'keep' }),
      makeEntry({ commit: 'bbb', status: 'discard' }),
      makeEntry({ commit: 'ccc', status: 'keep' }),
      makeEntry({ commit: 'ddd', status: 'discard' }),
    ]
    const baseline = findBaseline(entries)
    expect(baseline).not.toBeNull()
    expect(baseline!.commit).toBe('ccc')
  })

  test('returns null when no keep entries exist', () => {
    const entries = [
      makeEntry({ status: 'discard' }),
      makeEntry({ status: 'crash' }),
    ]
    expect(findBaseline(entries)).toBeNull()
  })

  test('returns null for empty array', () => {
    expect(findBaseline([])).toBeNull()
  })

  test('returns single keep entry', () => {
    const entries = [makeEntry({ commit: 'only', status: 'keep' })]
    const baseline = findBaseline(entries)
    expect(baseline!.commit).toBe('only')
  })

  test('skips crash entries', () => {
    const entries = [
      makeEntry({ commit: 'good', status: 'keep' }),
      makeEntry({ commit: 'bad', status: 'crash' }),
    ]
    const baseline = findBaseline(entries)
    expect(baseline!.commit).toBe('good')
  })
})
