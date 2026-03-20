import { describe, expect, test } from 'bun:test'
import { GraderResultSchema, RepoImprovementMetaVerifierOutcomeSchema } from '../../src/improve.ts'
import { toGraderResult } from '../claude-haiku-meta-verifier.ts'

describe('claude-haiku-meta-verifier', () => {
  test('returns a schema-valid meta verification result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.8,
      reasoning: 'primary judge looks internally consistent',
      dimensions: {
        consistency: 0.9,
        risk: 0.8,
        confidence: 0.7,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      RepoImprovementMetaVerifierOutcomeSchema.parse({
        evaluationTarget: result.outcome?.evaluationTarget,
        judgeKind: result.outcome?.judgeKind,
        rubric: result.outcome?.rubric,
      }),
    ).toEqual({
      evaluationTarget: 'repo-improvement',
      judgeKind: 'repo-improvement-meta-verifier',
      rubric: {
        consistency: 0.9,
        risk: 0.8,
        confidence: 0.7,
      },
    })
    expect(result.outcome?.metaVerificationDimensions).toEqual({
      consistency: 0.9,
      risk: 0.8,
      confidence: 0.7,
    })
  })
})
