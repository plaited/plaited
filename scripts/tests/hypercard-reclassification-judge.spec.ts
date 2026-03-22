import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import { HypercardReclassificationJudgeOutcomeSchema, toGraderResult } from '../hypercard-reclassification-judge.ts'

describe('hypercard-reclassification-judge', () => {
  test('returns a schema-valid grader result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.84,
      reasoning: 'The stack is more suite-like than the current S2 label suggests.',
      patternFamily: 'business-process',
      mss: {
        contentType: 'work-evaluation',
        structure: 'collection',
        mechanics: ['track'],
        boundary: 'none',
        scale: 4,
        confidence: 'medium',
      },
      keepForSeedReview: true,
      rationale: 'Payroll/history/reporting looks like a richer module seed.',
      dimensions: {
        scaleFit: 0.87,
        familyFit: 0.82,
        evidenceUse: 0.86,
        modernizationValue: 0.81,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(
      HypercardReclassificationJudgeOutcomeSchema.parse({
        judgeKind: result.outcome?.judgeKind,
        patternFamily: result.outcome?.patternFamily,
        mss: result.outcome?.mss,
        keepForSeedReview: result.outcome?.keepForSeedReview,
        rationale: result.outcome?.rationale,
      }),
    ).toEqual({
      judgeKind: 'hypercard-reclassification',
      patternFamily: 'business-process',
      mss: {
        contentType: 'work-evaluation',
        structure: 'collection',
        mechanics: ['track'],
        boundary: 'none',
        scale: 4,
        confidence: 'medium',
      },
      keepForSeedReview: true,
      rationale: 'Payroll/history/reporting looks like a richer module seed.',
    })
  })
})
