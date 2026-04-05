import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Adapter, PromptCase } from '../../eval/eval.schemas.ts'
import { AutoresearchInputSchema, AutoresearchOutputSchema } from '../autoresearch.schemas.ts'
import { runAutoresearch } from '../autoresearch.ts'
import {
  buildAutoresearchRunId,
  normalizeAutoresearchBudget,
  normalizeAutoresearchPromotion,
  summarizeTrialResults,
} from '../autoresearch.utils.ts'

describe('autoresearch schemas', () => {
  test('accepts a minimal autoresearch input', () => {
    const parsed = AutoresearchInputSchema.parse({
      target: { kind: 'skill', id: 'search-bun-docs' },
      adapterPath: '/tmp/adapter.ts',
      promptsPath: '/tmp/prompts.jsonl',
    })

    expect(parsed.target.kind).toBe('skill')
    expect(parsed.progress).toBe(false)
  })

  test('accepts a minimal autoresearch output', () => {
    const parsed = AutoresearchOutputSchema.parse({
      runId: 'skill-search-bun-docs-run',
      target: { kind: 'skill', id: 'search-bun-docs' },
      baselineSummary: { passRate: 0.5 },
      candidates: [],
      promotion: {
        decision: 'deferred',
        reasoning: 'No candidates',
      },
    })

    expect(parsed.promotion.decision).toBe('deferred')
  })
})

describe('autoresearch utils', () => {
  test('builds a target-prefixed run id', () => {
    const runId = buildAutoresearchRunId({ kind: 'factory', id: 'skills-factory' })

    expect(runId.startsWith('factory-skills-factory-')).toBe(true)
  })

  test('normalizes budget defaults', () => {
    expect(normalizeAutoresearchBudget()).toEqual({
      maxCandidates: 3,
      maxAttemptsPerCandidate: 1,
      concurrency: 1,
    })
  })

  test('normalizes promotion defaults', () => {
    expect(normalizeAutoresearchPromotion()).toEqual({
      mode: 'none',
    })
  })

  test('summarizes trial result averages', () => {
    const summary = summarizeTrialResults([
      {
        id: 'a',
        input: 'alpha',
        k: 1,
        trials: [{ trialNum: 1, output: 'ok', duration: 1, pass: true }],
        passRate: 1,
        passAtK: 1,
        passExpK: 1,
      },
      {
        id: 'b',
        input: 'beta',
        k: 1,
        trials: [{ trialNum: 1, output: 'no', duration: 1, pass: false }],
        passRate: 0,
        passAtK: 0,
        passExpK: 0,
      },
    ])

    expect(summary).toEqual({
      passRate: 0.5,
      passAtK: 0.5,
      passExpK: 0.5,
    })
  })
})

describe('runAutoresearch', () => {
  let tempDir: string | undefined

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = undefined
    }
  })

  test('writes baseline and proposal artifacts for a skill target', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'plaited-autoresearch-'))

    const prompts: PromptCase[] = [
      {
        id: 'needs-work',
        input: 'repair the skill',
      },
    ]

    const adapter: Adapter = async () => ({
      output: 'not yet',
    })

    const result = await runAutoresearch({
      target: { kind: 'skill', id: 'search-bun-docs' },
      adapter,
      prompts,
      grader: async () => ({
        pass: false,
        score: 0,
        reasoning: 'baseline failure',
      }),
      outputDir: tempDir,
    })

    expect(result.target.kind).toBe('skill')
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]?.validation).toBe('passed')
    expect(result.promotion.decision).toBe('deferred')

    expect(await Bun.file(join(tempDir, 'run.json')).exists()).toBe(true)
    expect(await Bun.file(join(tempDir, 'baseline.jsonl')).exists()).toBe(true)
    expect(await Bun.file(join(tempDir, 'observations.jsonl')).exists()).toBe(true)
    expect(await Bun.file(join(tempDir, 'candidates.jsonl')).exists()).toBe(true)
    expect(await Bun.file(join(tempDir, 'promotion.json')).exists()).toBe(true)
  })
})
