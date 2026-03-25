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
    generatedModernTitle: 'Farm Stand Module',
    generatedPromptInput: 'Create a bound farm produce card with name, logo, and contact method.',
    generatedPromptHint: 'Build one compact module for listing produce items.',
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
    expect(result.checks.sourceScaleFits).toBe(true)
    expect(result.checks.sourceHasRewrittenSeed).toBe(true)
    expect(result.checks.hasRewrittenSeedAnchor).toBe(true)
    expect(result.checks.hasSourceLexicalAnchor).toBe(true)
    expect(result.checks.hasSourceEvidenceAnchor).toBe(true)
  })

  test('tracks precursor shape continuity signals', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s2-produced-list-index-list',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S2',
        input: 'Create a module index for all produce entries so users can filter by season and open one detail view.',
        hint: 'Derived S2 precursor candidate for module index list.',
        seedContext: {
          sourceShape: 'module-index',
        },
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.checks.candidateShapeKnown).toBe(true)
    expect(result.checks.candidateShapeAnchor).toBe(true)
    expect(result.checks.shapeScaleAligned).toBe(true)
    expect(result.softWarnings).not.toContainEqual(expect.stringContaining('shape-scale-mismatch'))
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

  test('flags weak source evidence overlap as a warning', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s1-timeline-utility',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S1',
        input: 'Create a customer feedback timeline where each note is grouped by status and archived by month.',
        hint: 'Build one utility surface with custom filters and metrics.',
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.checks.hasSourceEvidenceAnchor).toBe(false)
    expect(result.softWarnings).toContain('weak-lexical-anchor')
    expect(result.softWarnings).toContain('missing-source-evidence-anchor')
  })

  test('requires lexical/evidence anchors when explicit chain context is present', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s1-review-check',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S1',
        input: 'Review one item and mark one status quickly for follow-up.',
        hint: 'Derived S1 precursor for review workflow.',
        chain: {
          immediateParentPromptId: 'farm-stand-s2-review-board',
          parentScaleLabel: 'S2',
          chainPath: ['S5', 'S3', 'S2', 'S1'],
        },
        seedContext: {
          sourceMechanics: 'review',
          chainImmediateParentMechanics: 'review',
          chainImmediateParentReusableActions: 'review check',
          chainImmediateParentOperationalLoop: 'for each',
          chainImmediateParentSubject: 'quality review',
          chainExpectedParentMechanism: 'review',
          chainImmediateParentMechanism: 'review',
          approvedParentMechanism: 'review',
          approvedParentSubject: 'quality review',
        },
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.checks.hasSourceLexicalAnchor).toBe(false)
    expect(result.checks.hasSourceEvidenceAnchor).toBe(false)
    expect(result.softWarnings).toContain('weak-lexical-anchor')
    expect(result.softWarnings).toContain('missing-source-evidence-anchor')
  })

  test('checks precursor chain parent and scale continuity', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s2-bad-chain',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S2',
        input: 'List produce with a bounded browse card so customers can view each price.',
        hint: 'Derived S2 precursor for a bigger module.',
        chain: {
          rootSourceId: 'farm-stand-s5-module',
          immediateParentPromptId: 'wrong-parent-id',
          expectedParentPromptId: 'farm-stand-s5-module-derived-s3',
          parentScaleLabel: 'S2',
          chainPath: ['S5', 'S1'],
        },
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.pass).toBe(true)
    expect(result.softWarnings).toContain('chain-parent-mismatch:wrong-parent-id')
    expect(result.softWarnings).toContain('chain-scale-mismatch:S2->S3')
    expect(result.checks.chainParentMatch).toBe(false)
    expect(result.checks.chainContinuity).toBe(false)
  })

  test('penalizes missing reusable action loop continuity', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s1-list-card-loop',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S1',
        input: 'Build one bounded card that displays a single produce title and a single action for customers.',
        hint: 'Derived S1 precursor candidate. Keep this as one compact card.',
        seedContext: {
          chainImmediateParentReusableActions: 'filter browse open',
          reusableActions: 'filter browse open',
        },
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.checks.reusableActionLoopContinuity).toBe(false)
    expect(result.softWarnings).toContain('missing-reusable-action-loop:filter browse open')
  })

  test('flags missing approved-parent mechanism continuity', () => {
    const result = assessDerivedPromptCandidate({
      candidate: {
        id: 'farm-stand-s1-miss-mech',
        sourceId: 'farm-stand-s5-module',
        targetScale: 'S1',
        input: 'Add a simple card that lets people read produce notes in one place.',
        hint: 'Derived S1 precursor for farm stand.',
        seedContext: {
          approvedParentMechanism: 'translate',
        },
      },
      sourcePrompt,
      seenIds: new Set<string>(),
    })

    expect(result.checks.approvedParentMechanicContinuity).toBe(false)
    expect(result.softWarnings).toContain('missing-approved-parent-mechanics:translate')
  })
})
