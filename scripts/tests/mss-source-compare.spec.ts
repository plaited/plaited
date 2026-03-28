import { describe, expect, test } from 'bun:test'
import type { ComparisonSection } from '../mss-source-compare.ts'
import {
  buildConceptPrompt,
  buildDeterministicPairs,
  buildPairReviewPrompt,
  buildSignature,
  classifyDisposition,
  cosineSimilarity,
  DEFAULT_MSS_COMPARE_EMBEDDING_MODEL,
  jaccardSimilarity,
  tokenize,
} from '../mss-source-compare.ts'

const makeSection = (overrides: Partial<ComparisonSection>): ComparisonSection => ({
  id: overrides.id ?? 'section-1',
  path: overrides.path ?? '/tmp/a.md',
  heading: overrides.heading ?? 'Boundary',
  headingPath: overrides.headingPath ?? ['Boundary'],
  kind: overrides.kind ?? 'notes',
  text: overrides.text ?? 'Boundary determines how data is shared.',
  sourceFamily: overrides.sourceFamily ?? 'mss',
})

describe('mss-source-compare', () => {
  test('tokenize removes stop words and normalizes text', () => {
    expect(tokenize('What is the boundary of the system?')).toEqual(['boundary', 'system'])
  })

  test('buildSignature mixes heading and text terms', () => {
    const signature = buildSignature({
      headingPath: ['Boundary'],
      text: 'Boundary determines how data is shared between agents.',
    })

    expect(signature).toContain('boundary')
    expect(signature).toContain('shared')
    expect(signature).toContain('agents')
  })

  test('jaccardSimilarity returns overlap ratio', () => {
    expect(jaccardSimilarity(['boundary', 'scale'], ['boundary', 'mechanics'])).toBeCloseTo(1 / 3)
  })

  test('cosineSimilarity returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2], [1, 2])).toBeCloseTo(1)
  })

  test('uses the free Nemotron embedding model by default for compare runs', () => {
    expect(DEFAULT_MSS_COMPARE_EMBEDDING_MODEL).toBe('nvidia/llama-nemotron-embed-vl-1b-v2:free')
  })

  test('classifyDisposition flags old template assumptions for reinterpretation', () => {
    expect(
      classifyDisposition({
        path: '/tmp/source.md',
        text: 'Platform patterns exist as templates and modules auto-group into views.',
      }),
    ).toBe('reinterpret')
  })

  test('buildDeterministicPairs compares across source families only', () => {
    const left = makeSection({
      id: 'left',
      path: '/tmp/mss.md',
      sourceFamily: 'mss',
      headingPath: ['Boundary'],
      text: 'Boundary determines what data can be shared across agents.',
    })
    const right = makeSection({
      id: 'right',
      path: '/tmp/chunk.md',
      sourceFamily: 'docs-chunks',
      headingPath: ['Channels and Boundary'],
      text: 'Boundary determines how information is shared across systems and agents.',
    })
    const ignored = makeSection({
      id: 'ignored',
      path: '/tmp/other.md',
      sourceFamily: 'mss',
      headingPath: ['Boundary'],
      text: 'Boundary also appears here but in the same source family.',
    })

    const pairs = buildDeterministicPairs([left, right, ignored], 10)

    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.leftId).toBe('left')
    expect(pairs[0]?.rightId).toBe('right')
  })

  test('prompt builders include both source context and extraction guidance', () => {
    const left = makeSection({ id: 'left', path: '/tmp/a.md', sourceFamily: 'mss' })
    const right = makeSection({ id: 'right', path: '/tmp/b.md', sourceFamily: 'docs-chunks' })

    expect(buildPairReviewPrompt({ left, right })).toContain('Compare these two source sections')
    expect(buildConceptPrompt({ section: left })).toContain('Extract normalized hypergraph candidates')
  })
})
