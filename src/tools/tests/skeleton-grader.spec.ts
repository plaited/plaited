/**
 * Tests for the module skeleton grader.
 *
 * @remarks
 * Covers: perfect match, partial match, all wrong, name validation,
 * ModnetFieldSchema gate, structure–scale compatibility, JSON extraction,
 * mechanics order independence, invalid input handling, and prompts data validation.
 */

import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { grade } from '../skeleton-grader.ts'

// ============================================================================
// Helpers
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '../../..')
const PROMPTS_PATH = resolve(PROJECT_ROOT, 'skills/modnet-node/assets/skeleton-prompts.jsonl')

const refSkeleton = {
  contentType: 'tools',
  structure: 'form',
  mechanics: [] as string[],
  boundary: 'all',
  scale: 1,
}

const makeOutput = (skeleton: Record<string, unknown>): string => JSON.stringify(skeleton)

const fullSkeleton = (overrides?: Record<string, unknown>) => ({
  name: 'my-module',
  ...refSkeleton,
  ...overrides,
})

// ============================================================================
// Core Grading
// ============================================================================

describe('grade — core', () => {
  test('perfect match returns pass=true, score=1', async () => {
    const result = await grade({
      input: 'A format converter',
      output: makeOutput(fullSkeleton()),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1)
    expect(result.reasoning).toContain('All 6 skeleton fields valid')
  })

  test('all fields wrong returns pass=false, score=0', async () => {
    const result = await grade({
      input: 'A format converter',
      output: makeOutput({
        name: 'INVALID NAME!!!',
        contentType: 'social',
        structure: 'feed',
        mechanics: ['vote'],
        boundary: 'none',
        scale: 3,
      }),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('0/6')
  })

  test('partial match returns fractional score', async () => {
    const result = await grade({
      input: 'A format converter',
      output: makeOutput({
        name: 'my-converter', // valid format ✓
        contentType: 'tools', // correct ✓
        structure: 'form', // correct ✓
        mechanics: [], // correct ✓
        boundary: 'none', // wrong ✗
        scale: 3, // wrong ✗
      }),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(4 / 6)
    expect(result.reasoning).toContain('4/6')
    expect(result.reasoning).toContain('boundary')
    expect(result.reasoning).toContain('scale')
  })

  test('single MSS field mismatch reports the specific field', async () => {
    const result = await grade({
      input: 'A format converter',
      output: makeOutput(fullSkeleton({ contentType: 'science' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(5 / 6)
    expect(result.reasoning).toContain('contentType')
    expect(result.reasoning).toContain('"science"')
  })
})

// ============================================================================
// Name Validation
// ============================================================================

describe('grade — name', () => {
  test('valid kebab-case name passes', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: 'format-converter' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(true)
  })

  test('single-word lowercase name passes', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: 'converter' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(true)
  })

  test('uppercase name fails name field', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: 'MyConverter' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(5 / 6)
    expect(result.reasoning).toContain('name')
  })

  test('name with spaces fails', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: 'my converter' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('name')
  })

  test('name with underscores fails', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: 'my_converter' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('name')
  })

  test('empty name fails', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: '' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('name')
  })

  test('missing name field fails', async () => {
    const { name: _, ...noName } = fullSkeleton()
    const result = await grade({
      input: 'A converter',
      output: makeOutput(noName),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('name')
  })

  test('name with leading hyphen fails', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: '-converter' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
  })

  test('name with consecutive hyphens fails', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ name: 'my--converter' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
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
        name: 'social-feed',
        ...socialRef,
        mechanics: ['post', 'share', 'follow', 'like'],
      }),
      metadata: { skeleton: socialRef },
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1)
  })

  test('missing mechanic causes mechanics field to fail', async () => {
    const result = await grade({
      input: 'Social feed',
      output: makeOutput({
        name: 'social-feed',
        ...socialRef,
        mechanics: ['like', 'follow', 'share'],
      }),
      metadata: { skeleton: socialRef },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('mechanics')
  })

  test('extra mechanic causes mechanics field to fail', async () => {
    const result = await grade({
      input: 'Social feed',
      output: makeOutput({
        name: 'social-feed',
        ...socialRef,
        mechanics: ['like', 'follow', 'share', 'post', 'vote'],
      }),
      metadata: { skeleton: socialRef },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('mechanics')
  })

  test('empty mechanics match empty reference', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
      metadata: { skeleton: refSkeleton },
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
      input: 'A converter',
      output: makeOutput(fullSkeleton({ scale: '1' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(true)
  })
})

// ============================================================================
// JSON Extraction
// ============================================================================

describe('grade — JSON extraction', () => {
  test('extracts JSON from markdown code fence', async () => {
    const fenced = '```json\n' + makeOutput(fullSkeleton()) + '\n```'
    const result = await grade({
      input: 'A converter',
      output: fenced,
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(true)
  })

  test('extracts JSON from text with surrounding content', async () => {
    const wrapped = `Here is the skeleton:\n${makeOutput(fullSkeleton())}\nThat's my answer.`
    const result = await grade({
      input: 'A converter',
      output: wrapped,
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(true)
  })

  test('unparseable output returns score=0 with reasoning', async () => {
    const result = await grade({
      input: 'A converter',
      output: 'This is not JSON at all, just text with no braces',
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('Could not parse JSON')
  })

  test('empty output returns score=0', async () => {
    const result = await grade({
      input: 'A converter',
      output: '',
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
  })
})

// ============================================================================
// Missing / Invalid Metadata
// ============================================================================

describe('grade — metadata', () => {
  test('no metadata.skeleton returns score=0', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
      metadata: {},
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('No reference skeleton')
  })

  test('undefined metadata returns score=0', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
  })
})

// ============================================================================
// ModnetFieldSchema Gate
// ============================================================================

describe('grade — schema validation', () => {
  test('invalid scale triggers schema warning', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ scale: 9 })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    const outcome = result.outcome as { warnings: string[] }
    expect(outcome.warnings.length).toBeGreaterThan(0)
    expect(outcome.warnings.some((w: string) => w.includes('ModnetFieldSchema'))).toBe(true)
  })

  test('invalid boundary triggers schema warning', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton({ boundary: 'maybe' })),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(false)
    const outcome = result.outcome as { warnings: string[] }
    expect(outcome.warnings.some((w: string) => w.includes('ModnetFieldSchema'))).toBe(true)
  })

  test('valid skeleton passes schema gate', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.pass).toBe(true)
    const outcome = result.outcome as { schemaValid: boolean }
    expect(outcome.schemaValid).toBe(true)
  })
})

// ============================================================================
// Structure–Scale Compatibility
// ============================================================================

describe('grade — structure-scale compatibility', () => {
  test('feed at S1 triggers compatibility warning', async () => {
    const result = await grade({
      input: 'Something',
      output: makeOutput(fullSkeleton({ structure: 'feed', scale: 1 })),
      metadata: { skeleton: { ...refSkeleton, structure: 'feed', scale: 1 } },
    })

    const outcome = result.outcome as { warnings: string[] }
    expect(outcome.warnings.some((w: string) => w.includes('not valid at scale'))).toBe(true)
  })

  test('form at S1 has no compatibility warning', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
      metadata: { skeleton: refSkeleton },
    })

    const outcome = result.outcome as { warnings: string[] }
    expect(outcome.warnings.filter((w: string) => w.includes('not valid at scale'))).toHaveLength(0)
  })

  test('pool at S3 has no compatibility warning', async () => {
    const s3Ref = { contentType: 'tools', structure: 'pool', mechanics: ['filter'], boundary: 'none', scale: 3 }
    const result = await grade({
      input: 'A dashboard',
      output: makeOutput({ name: 'my-dashboard', ...s3Ref }),
      metadata: { skeleton: s3Ref },
    })

    expect(result.pass).toBe(true)
    const outcome = result.outcome as { warnings: string[] }
    expect(outcome.warnings.filter((w: string) => w.includes('not valid at scale'))).toHaveLength(0)
  })
})

// ============================================================================
// GraderResult Shape
// ============================================================================

describe('grade — result shape', () => {
  test('result includes outcome.fieldResults', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.outcome).toBeDefined()
    const fieldResults = (result.outcome as { fieldResults: Record<string, unknown> }).fieldResults
    expect(fieldResults).toBeDefined()
    expect(Object.keys(fieldResults)).toEqual(
      expect.arrayContaining(['name', 'contentType', 'structure', 'mechanics', 'boundary', 'scale']),
    )
  })

  test('result includes dimensions.outcome', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
      metadata: { skeleton: refSkeleton },
    })

    expect(result.dimensions).toBeDefined()
    expect(result.dimensions!.outcome).toBe(1)
  })

  test('result includes schemaValid flag', async () => {
    const result = await grade({
      input: 'A converter',
      output: makeOutput(fullSkeleton()),
      metadata: { skeleton: refSkeleton },
    })

    const outcome = result.outcome as { schemaValid: boolean }
    expect(outcome.schemaValid).toBe(true)
  })
})

// ============================================================================
// Prompts Data Validation
// ============================================================================

describe('skeleton-prompts.jsonl', () => {
  const VALID_STRUCTURES = [
    'object', 'list', 'collection', 'steps', 'form',
    'pool', 'stream', 'feed', 'wall', 'thread',
  ]
  const VALID_BOUNDARIES = ['all', 'none', 'ask', 'paid']
  const VALID_MECHANICS = [
    'vote', 'karma', 'follow', 'like', 'swipe', 'scarcity', 'limited-loops',
    'sort', 'filter', 'track', 'chart', 'post', 'reply', 'share', 'gold',
  ]

  type SkeletonTags = {
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
      scale: number
      skeleton: SkeletonTags
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
      expect(p.metadata.scale).toBeDefined()
      expect(p.metadata.skeleton).toBeDefined()
    }
  })

  test('all IDs are unique', () => {
    const ids = prompts.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('all IDs start with skeleton-', () => {
    for (const p of prompts) {
      expect(p.id.startsWith('skeleton-')).toBe(true)
    }
  })

  test('difficulty is easy | medium | hard', () => {
    for (const p of prompts) {
      expect(['easy', 'medium', 'hard']).toContain(p.metadata.difficulty)
    }
  })

  test('metadata.scale matches skeleton.scale', () => {
    for (const p of prompts) {
      expect(p.metadata.scale).toBe(p.metadata.skeleton.scale)
    }
  })

  test('structure is a valid MSS structure value', () => {
    for (const p of prompts) {
      expect(VALID_STRUCTURES).toContain(p.metadata.skeleton.structure)
    }
  })

  test('boundary is valid', () => {
    for (const p of prompts) {
      expect(VALID_BOUNDARIES).toContain(p.metadata.skeleton.boundary)
    }
  })

  test('mechanics are valid', () => {
    for (const p of prompts) {
      expect(Array.isArray(p.metadata.skeleton.mechanics)).toBe(true)
      for (const m of p.metadata.skeleton.mechanics) {
        expect(VALID_MECHANICS).toContain(m)
      }
    }
  })

  test('scale is integer 1-4', () => {
    for (const p of prompts) {
      const s = p.metadata.skeleton.scale
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(1)
      expect(s).toBeLessThanOrEqual(4)
    }
  })

  test('structure is valid for its scale level', () => {
    const validForScale: Record<number, string[]> = {
      1: ['object', 'form'],
      2: ['object', 'list', 'collection', 'steps', 'form'],
      3: ['pool', 'stream', 'feed', 'wall', 'thread', 'form', 'collection', 'steps'],
      4: ['object', 'list', 'collection', 'steps', 'form', 'pool', 'stream', 'feed', 'wall', 'thread'],
    }

    for (const p of prompts) {
      const valid = validForScale[p.metadata.skeleton.scale]!
      expect(valid).toContain(p.metadata.skeleton.structure)
    }
  })

  test('covers all scale levels S1-S4', () => {
    const scales = new Set(prompts.map((p) => p.metadata.skeleton.scale))
    expect(scales.has(1)).toBe(true)
    expect(scales.has(2)).toBe(true)
    expect(scales.has(3)).toBe(true)
    expect(scales.has(4)).toBe(true)
  })
})
