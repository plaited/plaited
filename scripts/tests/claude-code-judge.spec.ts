import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import { toGraderResult } from '../claude-code-judge.ts'

describe('claude-code-judge', () => {
  test('returns a schema-valid grader result', () => {
    const result = toGraderResult({
      pass: true,
      score: 0.9,
      reasoning: 'bounded and aligned',
      dimensions: {
        architecture: 0.95,
        boundedness: 0.9,
        focus: 0.92,
        quality: 0.85,
      },
    })

    expect(GraderResultSchema.parse(result)).toEqual(result)
  })
})
