/**
 * Tests for the MSS classification grader.
 *
 * @remarks
 * Covers: perfect match, partial match, all wrong, JSON extraction strategies,
 * mechanics order independence, invalid input handling, and prompts data validation.
 */

import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { grade } from '../mss-grader.ts'

// ============================================================================
// Helpers
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '../..')
const PROMPTS_PATH = resolve(PROJECT_ROOT, 'skills/mss-vocabulary/assets/mss-classify-prompts.jsonl')

const refMss = {
  contentType: 'tools',
  structure: 'form',
  mechanics: [] as string[],
  boundary: 'all',
  scale: 1,
}

const makeOutput = (tags: Record<string, unknown>): string => JSON.stringify(tags)

// ============================================================================
// Core Grading
// ============================================================================

describe('grade — core', () => {
  test('perfect match returns pass=true, score=1', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput(refMss),
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1)
    expect(result.reasoning).toContain('All 5 MSS fields match')
  })

  test('all fields wrong returns pass=false, score=0', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput({
        contentType: 'social',
        structure: 'feed',
        mechanics: ['vote'],
        boundary: 'none',
        scale: 7,
      }),
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('0/5')
  })

  test('partial match returns fractional score', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput({
        contentType: 'tools', // correct
        structure: 'form', // correct
        mechanics: [], // correct
        boundary: 'none', // wrong
        scale: 3, // wrong
      }),
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(3 / 5)
    expect(result.reasoning).toContain('3/5')
    expect(result.reasoning).toContain('boundary')
    expect(result.reasoning).toContain('scale')
  })

  test('single field mismatch reports the specific field', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput({ ...refMss, contentType: 'science' }),
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(4 / 5)
    expect(result.reasoning).toContain('contentType')
    expect(result.reasoning).toContain('"science"')
  })
})

// ============================================================================
// Mechanics Comparison
// ============================================================================

describe('grade — mechanics', () => {
  const socialRef = {
    contentType: 'social',
    structure: 'feed',
    mechanics: ['like', 'follow', 'share', 'post'],
    boundary: 'ask',
    scale: 3,
  }

  test('order-independent match on mechanics array', async () => {
    const result = await grade({
      input: 'Social feed',
      output: makeOutput({
        ...socialRef,
        mechanics: ['post', 'share', 'follow', 'like'], // reversed order
      }),
      metadata: { mss: socialRef },
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1)
  })

  test('missing mechanic causes mechanics field to fail', async () => {
    const result = await grade({
      input: 'Social feed',
      output: makeOutput({
        ...socialRef,
        mechanics: ['like', 'follow', 'share'], // missing 'post'
      }),
      metadata: { mss: socialRef },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('mechanics')
  })

  test('extra mechanic causes mechanics field to fail', async () => {
    const result = await grade({
      input: 'Social feed',
      output: makeOutput({
        ...socialRef,
        mechanics: ['like', 'follow', 'share', 'post', 'vote'], // extra 'vote'
      }),
      metadata: { mss: socialRef },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('mechanics')
  })

  test('empty mechanics match empty reference', async () => {
    const result = await grade({
      input: 'Unit converter',
      output: makeOutput(refMss), // mechanics: []
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(true)
  })
})

// ============================================================================
// Scale Comparison
// ============================================================================

describe('grade — scale', () => {
  test('string scale matches numeric reference', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput({ ...refMss, scale: '1' }), // string "1"
      metadata: { mss: refMss }, // scale: 1 (number)
    })

    // scale comparison uses Number() coercion
    expect(result.pass).toBe(true)
  })
})

// ============================================================================
// JSON Extraction
// ============================================================================

describe('grade — JSON extraction', () => {
  test('extracts JSON from markdown code fence', async () => {
    const fenced = '```json\n' + makeOutput(refMss) + '\n```'
    const result = await grade({
      input: 'A unit converter',
      output: fenced,
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(true)
  })

  test('extracts JSON from text with surrounding content', async () => {
    const wrapped = `Here is the classification:\n${makeOutput(refMss)}\nThat's my answer.`
    const result = await grade({
      input: 'A unit converter',
      output: wrapped,
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(true)
  })

  test('unparseable output returns score=0 with reasoning', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: 'This is not JSON at all, just text with no braces',
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('Could not parse JSON')
  })

  test('empty output returns score=0', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: '',
      metadata: { mss: refMss },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
  })
})

// ============================================================================
// Missing / Invalid Metadata
// ============================================================================

describe('grade — metadata', () => {
  test('no metadata.mss returns score=0', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput(refMss),
      metadata: {},
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('No reference MSS tags')
  })

  test('undefined metadata returns score=0', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput(refMss),
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
  })
})

// ============================================================================
// GraderResult shape
// ============================================================================

describe('grade — result shape', () => {
  test('result includes outcome.fieldResults', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput(refMss),
      metadata: { mss: refMss },
    })

    expect(result.outcome).toBeDefined()
    const fieldResults = (result.outcome as { fieldResults: Record<string, unknown> }).fieldResults
    expect(fieldResults).toBeDefined()
    expect(Object.keys(fieldResults)).toEqual(
      expect.arrayContaining(['contentType', 'structure', 'mechanics', 'boundary', 'scale']),
    )
  })

  test('result includes dimensions.outcome', async () => {
    const result = await grade({
      input: 'A unit converter',
      output: makeOutput(refMss),
      metadata: { mss: refMss },
    })

    expect(result.dimensions).toBeDefined()
    expect(result.dimensions!.outcome).toBe(1)
  })
})

// ============================================================================
// Prompts Data Validation
// ============================================================================

describe('mss-classify-prompts.jsonl', () => {
  // Canonical types from SKILL.md table + example types from disambiguation section
  const VALID_CONTENT_TYPE_BASES = [
    'health', 'social', 'science', 'finance', 'logistics', 'tools', 'art',
    'entertainment', 'education', 'geo', 'weather', 'news', 'real-estate', 'commerce',
    'produce', 'work', 'play', 'family',
  ]
  const VALID_STRUCTURES = [
    'object', 'list', 'collection', 'steps', 'form',
    'pool', 'stream', 'feed', 'wall', 'thread',
    'daisy', 'hierarchy', 'matrix', 'hypertext',
  ]
  const VALID_BOUNDARIES = ['all', 'none', 'ask', 'paid']
  const VALID_MECHANICS = [
    'vote', 'karma', 'follow', 'like', 'swipe', 'scarcity', 'limited-loops',
    'sort', 'filter', 'track', 'chart', 'post', 'reply', 'share', 'gold',
  ]

  type MssTags = {
    contentType: string
    structure: string
    mechanics: string[]
    boundary: string
    scale: number
  }

  type PromptEntry = {
    id: string
    input: string
    metadata: {
      domain: string
      difficulty: string
      phase: string
      mss: MssTags
    }
  }

  let prompts: PromptEntry[] = []

  test('loads all 20 prompts', async () => {
    const text = await Bun.file(PROMPTS_PATH).text()
    prompts = text
      .trim()
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as PromptEntry)
    expect(prompts).toHaveLength(20)
  })

  test('each prompt has required fields', () => {
    for (const p of prompts) {
      expect(p.id).toBeDefined()
      expect(typeof p.id).toBe('string')
      expect(p.input).toBeDefined()
      expect(p.input.length).toBeGreaterThan(20)
      expect(p.metadata).toBeDefined()
      expect(p.metadata.domain).toBeDefined()
      expect(p.metadata.difficulty).toBeDefined()
      expect(p.metadata.phase).toBeDefined()
      expect(p.metadata.mss).toBeDefined()
    }
  })

  test('all IDs are unique', () => {
    const ids = prompts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('difficulty is easy | medium | hard', () => {
    for (const p of prompts) {
      expect(['easy', 'medium', 'hard']).toContain(p.metadata.difficulty)
    }
  })

  test('phase is create | compose | evolve | network', () => {
    for (const p of prompts) {
      expect(['create', 'compose', 'evolve', 'network']).toContain(p.metadata.phase)
    }
  })

  test('contentType is canonical or hyphenated domain variant', () => {
    for (const p of prompts) {
      const ct = p.metadata.mss.contentType
      // Allow canonical types + hyphenated variants (e.g., health-research, social-identity, play-cocreation)
      const base = ct.split('-')[0]!
      expect(VALID_CONTENT_TYPE_BASES).toContain(base)
    }
  })

  test('structure is a valid MSS structure value', () => {
    for (const p of prompts) {
      expect(VALID_STRUCTURES).toContain(p.metadata.mss.structure)
    }
  })

  test('boundary is valid', () => {
    for (const p of prompts) {
      expect(VALID_BOUNDARIES).toContain(p.metadata.mss.boundary)
    }
  })

  test('mechanics are valid', () => {
    for (const p of prompts) {
      expect(Array.isArray(p.metadata.mss.mechanics)).toBe(true)
      for (const m of p.metadata.mss.mechanics) {
        expect(VALID_MECHANICS).toContain(m)
      }
    }
  })

  test('scale is integer 1-8', () => {
    for (const p of prompts) {
      const s = p.metadata.mss.scale
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(1)
      expect(s).toBeLessThanOrEqual(8)
    }
  })
})
