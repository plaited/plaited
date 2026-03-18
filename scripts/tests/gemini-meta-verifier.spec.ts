import { describe, expect, test } from 'bun:test'
import { GraderResultSchema } from '../../src/improve.ts'
import { toGraderResult } from '../gemini-meta-verifier.ts'

describe('gemini-meta-verifier', () => {
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
  })
})
