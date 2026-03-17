import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import { toGraderResult } from '../gemini-judge.ts'

describe('toGraderResult', () => {
  test('returns a schema-valid grader result without judge dimensions', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.9,
      reasoning: 'Looks good',
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(result.outcome).toBeUndefined()
  })

  test('stores judge dimensions under outcome metadata', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.8,
      reasoning: 'Bounded and safe',
      dimensions: {
        impact: 0.9,
        focus: 0.8,
        safety: 0.7,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
    expect(result.outcome).toEqual({
      judgeDimensions: {
        impact: 0.9,
        focus: 0.8,
        safety: 0.7,
      },
    })
  })
})
