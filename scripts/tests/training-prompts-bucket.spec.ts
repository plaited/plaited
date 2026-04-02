import { describe, expect, test } from 'bun:test'
import { chunkArray, normalizeBucketKey, validateAssignments } from '../training-prompts-bucket.ts'

describe('training-prompts-bucket', () => {
  test('normalizes bucket keys into slugs', () => {
    expect(normalizeBucketKey('Farmers Market')).toBe('farmers-market')
    expect(normalizeBucketKey('  Household / Home  ')).toBe('household-home')
  })

  test('chunks arrays by batch size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  test('validates one assignment per prompt id', () => {
    expect(() =>
      validateAssignments({
        promptIds: ['a', 'b'],
        assignments: [
          { id: 'a', bucketKey: 'x', rationale: 'fits x' },
          { id: 'b', bucketKey: 'y', rationale: 'fits y' },
        ],
      }),
    ).not.toThrow()

    expect(() =>
      validateAssignments({
        promptIds: ['a', 'b'],
        assignments: [
          { id: 'a', bucketKey: 'x', rationale: 'fits x' },
          { id: 'a', bucketKey: 'y', rationale: 'duplicate' },
        ],
      }),
    ).toThrow('Invalid bucket assignments')
  })
})
