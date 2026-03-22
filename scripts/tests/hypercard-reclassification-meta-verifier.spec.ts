import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import {
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
})
