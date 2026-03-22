import { describe, expect, test } from 'bun:test'
import type { PromptCase } from '../../src/improve.ts'
import { assessDerivedPromptCandidate } from '../modnet-prompt-derivation-evaluate.ts'

const sourcePrompt: PromptCase = {
  id: 'farm-stand-s5-module',
  input:
    'Build my complete farm stand module. Include my produce collections, my farm name and logo, and a way for customers to contact me.',
  hint: 'Generate a Plaited-native produce module at S5.',
  metadata: {
    patternFamily: 'personal-data-manager',
    judge: {
      requiredConcepts: ['module', 'mss', 'contentType-produce', 'structure-collection', 'scale-S5'],
    },
  },
}

describe('assessDerivedPromptCandidate', () => {
  test('accepts a source-anchored low-scale candidate', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s2-produce-list',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S2',
        input:
          'List my produce with prices, quantities, and harvest notes so customers can browse what is available today.',
        hint: 'Derived S2 precursor for the farm stand. Keep it focused on the produce list rather than the whole stand.',
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.pass).toBe(true)
    expect(result.hardFailures).toEqual([])
    expect(result.checks.sourceIsHigherScale).toBe(true)
    expect(result.checks.hasSourceLexicalAnchor).toBe(true)
  })

  test('rejects duplicate ids and missing higher-scale context', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s2-produce-list',
        sourceId: 'missing-source',
        targetScale: 'S2',
        input: 'Too short.',
        hint: 'short hint',
      },
      sourcePrompt: undefined,
      seenIds: new Set<string>(['farm-stand-s2-produce-list']),
    })

    expect(result.pass).toBe(false)
    expect(result.hardFailures).toEqual(
      expect.arrayContaining([
        'missing-source:missing-source',
        'duplicate-id:farm-stand-s2-produce-list',
        'input-too-short',
      ]),
    )
  })

  test('flags generic template language as a warning', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s3-derived',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S3',
        input: 'Build the block-level surface that organizes the lower-scale components for this larger module.',
        hint: 'Derived S3 precursor candidate.',
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.pass).toBe(true)
    expect(result.softWarnings).toContain('generic-template-language')
  })
})
