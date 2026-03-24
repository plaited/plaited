import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import {
  buildMetaPrompt,
  HypercardReclassificationMetaOutcomeSchema,
  toGraderResult,
} from '../hypercard-reclassification-meta-verifier.ts'

describe('hypercard-reclassification-meta-verifier', () => {
  test('returns a schema-valid meta verification result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.79,
      reasoning: 'The primary reclassification is consistent with the source evidence and prior.',
      dimensions: {
        consistency: 0.84,
        risk: 0.73,
        confidence: 0.8,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      HypercardReclassificationMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'hypercard-reclassification-meta-verifier',
      dimensions: {
        consistency: 0.84,
        risk: 0.73,
        confidence: 0.8,
      },
    })
  })

  test('preserves a schema-valid failed verification outcome for risky hard-case drift', () => {
    const result = toGraderResult({
      pass: false,
      score: 0.28,
      reasoning:
        'The primary judge over-read suite language, fell back to collection, and treated author contact text as module behavior.',
      dimensions: {
        consistency: 0.32,
        risk: 0.88,
        confidence: 0.24,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      HypercardReclassificationMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'hypercard-reclassification-meta-verifier',
      dimensions: {
        consistency: 0.32,
        risk: 0.88,
        confidence: 0.24,
      },
    })
  })

  test('builds lane-aware seed-promotion policy in meta prompt context', () => {
    const prompt = buildMetaPrompt({
      task: 'Validate this HyperCard seed reclassification.',
      output: JSON.stringify(
        {
          pass: true,
          score: 0.77,
          reasoning: 'Bounded S2 workflow with coherent mechanics.',
          outcome: {
            judgeKind: 'hypercard-reclassification',
            patternFamily: 'business-process',
            mss: {
              contentType: 'tracker',
              structure: 'list',
              mechanics: ['track', 'filter'],
              boundary: 'none',
              scale: 2,
              confidence: 'high',
            },
            keepForSeedReview: true,
            rationale: 'source aligned and reusable',
          },
        },
        null,
        2,
      ),
      metadata: {
        sourceRecord: {
          id: 'hypercard_meta_rescue',
          seedReviewContext: {
            provenance: 'iffy',
            recommendedFromSlice14: true,
            regenerationQualityScore: 0.91,
            antiInflationLevel: 'low',
            antiInflationSignals: [],
            sourceScale: 1,
            generatedScaleValue: 2,
          },
        },
        currentClassification: {
          patternFamily: 'business-process',
          mss: {
            contentType: 'tracker',
            structure: 'list',
            mechanics: ['track'],
            boundary: 'none',
            scale: 1,
            confidence: 'medium',
          },
        },
        heuristicPrior: {
          suggestedMinimumScale: 1,
          reasons: ['seed-review lane check'],
          scaleLooksUnderstated: true,
        },
      },
    })

    expect(prompt).toContain('Seed-promotion verifier policy:')
    expect(prompt).toContain('Seed-review lane: iffy-rescue')
    expect(prompt).toContain('allow pass when mechanics are explicit')
    expect(prompt).toContain('Primary judge summary')
  })
})
