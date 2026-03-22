import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import { ModnetDerivedPromptMetaOutcomeSchema, toGraderResult } from '../modnet-prompt-derivation-meta-verifier.ts'

describe('modnet-prompt-derivation-meta-verifier', () => {
  test('returns a schema-valid meta verification result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.78,
      reasoning: 'Primary judge reasoning matches the candidate and precheck.',
      dimensions: {
        consistency: 0.82,
        risk: 0.76,
        confidence: 0.79,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetDerivedPromptMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'modnet-derived-prompt-meta-verifier',
      dimensions: {
        consistency: 0.82,
        risk: 0.76,
        confidence: 0.79,
      },
    })
  })
})
