import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import { ModnetRawCardInclusionMetaOutcomeSchema, toGraderResult } from '../modnet-raw-card-inclusion-meta-verifier.ts'

describe('modnet-raw-card-inclusion-meta-verifier', () => {
  test('returns a schema-valid meta verification result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.81,
      reasoning: 'The primary inclusion result is consistent with the raw card and stays restrained.',
      dimensions: {
        consistency: 0.84,
        risk: 0.25,
        confidence: 0.8,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetRawCardInclusionMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'modnet-raw-card-inclusion-meta-verifier',
      dimensions: {
        consistency: 0.84,
        risk: 0.25,
        confidence: 0.8,
      },
    })
  })

  test('preserves a schema-valid risky failure outcome', () => {
    const result = toGraderResult({
      pass: false,
      score: 0.29,
      reasoning: 'The primary judge invented a generic analog and did not justify retention from the raw description.',
      dimensions: {
        consistency: 0.34,
        risk: 0.89,
        confidence: 0.27,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetRawCardInclusionMetaOutcomeSchema.parse({
        verifierKind: result.outcome?.verifierKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      verifierKind: 'modnet-raw-card-inclusion-meta-verifier',
      dimensions: {
        consistency: 0.34,
        risk: 0.89,
        confidence: 0.27,
      },
    })
  })
})
