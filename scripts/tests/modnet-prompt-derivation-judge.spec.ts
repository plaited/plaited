import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import { ModnetDerivedPromptJudgeOutcomeSchema, toGraderResult } from '../modnet-prompt-derivation-judge.ts'

describe('modnet-prompt-derivation-judge', () => {
  test('returns a schema-valid grader result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.86,
      reasoning: 'Strong source fidelity and good scale fit.',
      dimensions: {
        fidelity: 0.9,
        scaleFit: 0.88,
        usefulness: 0.84,
        specificity: 0.82,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      ModnetDerivedPromptJudgeOutcomeSchema.parse({
        judgeKind: result.outcome?.judgeKind,
        dimensions: result.outcome?.dimensions,
      }),
    ).toEqual({
      judgeKind: 'modnet-derived-prompt',
      dimensions: {
        fidelity: 0.9,
        scaleFit: 0.88,
        usefulness: 0.84,
        specificity: 0.82,
      },
    })
  })
})
