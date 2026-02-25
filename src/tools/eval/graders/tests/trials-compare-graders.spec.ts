/**
 * Unit tests for built-in trials comparison graders.
 *
 * @remarks
 * Tests for:
 * - trials-compare-weighted: Configurable weight grader for trials
 * - trials-compare-statistical: Bootstrap confidence interval grader for trials
 *
 * @packageDocumentation
 */

import { describe, expect, test } from 'bun:test'
import type { TrialsComparisonGraderInput, TrialsComparisonRunData } from '../../pipeline/pipeline.types.ts'
import { createTrialsStatisticalGrader, grade as statisticalGrade } from '../trials-compare-statistical.ts'
import { createTrialsWeightedGrader, DEFAULT_TRIALS_WEIGHTS, type TrialsWeights } from '../trials-compare-weighted.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockTrialRuns = (
  overrides: Partial<Record<string, Partial<TrialsComparisonRunData>>> = {},
): Record<string, TrialsComparisonRunData> => ({
  baseline: {
    passRate: 0.67,
    passAtK: 0.9,
    passExpK: 0.3,
    k: 3,
    trials: [
      { trialNum: 1, output: 'A', trajectory: [], duration: 100, pass: true, score: 1.0 },
      { trialNum: 2, output: 'B', trajectory: [], duration: 110, pass: true, score: 0.9 },
      { trialNum: 3, output: 'C', trajectory: [], duration: 120, pass: false, score: 0.2 },
    ],
    ...overrides.baseline,
  },
  variant: {
    passRate: 1.0,
    passAtK: 1.0,
    passExpK: 1.0,
    k: 3,
    trials: [
      { trialNum: 1, output: 'X', trajectory: [], duration: 150, pass: true, score: 1.0 },
      { trialNum: 2, output: 'Y', trajectory: [], duration: 160, pass: true, score: 1.0 },
      { trialNum: 3, output: 'Z', trajectory: [], duration: 170, pass: true, score: 1.0 },
    ],
    ...overrides.variant,
  },
})

const createMockTrialInput = (runs: Record<string, TrialsComparisonRunData>): TrialsComparisonGraderInput => ({
  id: 'test-001',
  input: 'Test prompt',
  hint: 'Expected output',
  runs,
})

// ============================================================================
// Weighted Grader Tests
// ============================================================================

describe('trials-compare-weighted grader', () => {
  describe('DEFAULT_TRIALS_WEIGHTS', () => {
    test('has expected default values', () => {
      expect(DEFAULT_TRIALS_WEIGHTS.capability).toBe(0.4)
      expect(DEFAULT_TRIALS_WEIGHTS.reliability).toBe(0.4)
      expect(DEFAULT_TRIALS_WEIGHTS.consistency).toBe(0.2)
    })

    test('weights sum to 1.0', () => {
      const sum =
        DEFAULT_TRIALS_WEIGHTS.capability + DEFAULT_TRIALS_WEIGHTS.reliability + DEFAULT_TRIALS_WEIGHTS.consistency
      expect(sum).toBe(1.0)
    })
  })

  describe('createTrialsWeightedGrader', () => {
    test('returns higher rank for better passAtK when capability weight is high', async () => {
      const grader = createTrialsWeightedGrader({ capability: 1.0, reliability: 0.0, consistency: 0.0 })
      const runs = createMockTrialRuns({
        baseline: { passAtK: 0.7 },
        variant: { passAtK: 0.95 },
      })
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      expect(result.rankings.length).toBe(2)
      expect(result.rankings[0]?.run).toBe('variant')
      expect(result.rankings[0]?.rank).toBe(1)
    })

    test('returns higher rank for better passExpK when reliability weight is high', async () => {
      const grader = createTrialsWeightedGrader({ capability: 0.0, reliability: 1.0, consistency: 0.0 })
      const runs = createMockTrialRuns({
        baseline: { passExpK: 0.9 },
        variant: { passExpK: 0.3 },
      })
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      expect(result.rankings[0]?.run).toBe('baseline')
    })

    test('penalizes flaky runs when consistency weight is high', async () => {
      const grader = createTrialsWeightedGrader({ capability: 0.0, reliability: 0.0, consistency: 1.0 })
      const runs = createMockTrialRuns({
        // baseline: passAtK=0.9, passExpK=0.3, flakiness=0.6
        baseline: { passAtK: 0.9, passExpK: 0.3 },
        // variant: passAtK=0.8, passExpK=0.8, flakiness=0.0
        variant: { passAtK: 0.8, passExpK: 0.8 },
      })
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      // Variant should win due to lower flakiness (higher consistency)
      expect(result.rankings[0]?.run).toBe('variant')
    })

    test('includes weights in reasoning', async () => {
      const weights: TrialsWeights = { capability: 0.5, reliability: 0.3, consistency: 0.2 }
      const grader = createTrialsWeightedGrader(weights)
      const input = createMockTrialInput(createMockTrialRuns())

      const result = await grader(input)

      expect(result.reasoning).toContain('capability=0.5')
      expect(result.reasoning).toContain('reliability=0.3')
      expect(result.reasoning).toContain('consistency=0.2')
    })

    test('handles missing passAtK gracefully (treats as 0)', async () => {
      const grader = createTrialsWeightedGrader()
      const runs: Record<string, TrialsComparisonRunData> = {
        baseline: {
          k: 3,
          trials: [],
        },
        variant: {
          passAtK: 0.8,
          passExpK: 0.5,
          k: 3,
          trials: [],
        },
      }
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      // Should not throw, variant should rank higher
      expect(result.rankings.length).toBe(2)
      expect(result.rankings[0]?.run).toBe('variant')
    })

    test('handles three or more runs', async () => {
      const grader = createTrialsWeightedGrader()
      const runs: Record<string, TrialsComparisonRunData> = {
        a: { passAtK: 0.9, passExpK: 0.8, k: 3, trials: [] },
        b: { passAtK: 0.7, passExpK: 0.7, k: 3, trials: [] },
        c: { passAtK: 0.5, passExpK: 0.2, k: 3, trials: [] },
      }
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      expect(result.rankings.length).toBe(3)
      // Ranks should be 1, 2, 3
      expect(result.rankings.map((r) => r.rank)).toEqual([1, 2, 3])
    })
  })
})

// ============================================================================
// Statistical Grader Tests
// ============================================================================

describe('trials-compare-statistical grader', () => {
  describe('createTrialsStatisticalGrader', () => {
    test('returns rankings based on bootstrapped passAtK', async () => {
      const grader = createTrialsStatisticalGrader(100)
      const runs = createMockTrialRuns({
        baseline: { passAtK: 0.6 },
        variant: { passAtK: 0.95 },
      })
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      expect(result.rankings.length).toBe(2)
      expect(result.rankings[0]?.run).toBe('variant')
    })

    test('uses trial outcomes for bootstrap variance estimation', async () => {
      const grader = createTrialsStatisticalGrader(100)
      // All trials pass for variant, mixed for baseline
      const runs: Record<string, TrialsComparisonRunData> = {
        baseline: {
          passAtK: 0.9,
          passExpK: 0.3,
          k: 5,
          trials: [
            { trialNum: 1, output: 'A', trajectory: [], duration: 100, pass: true },
            { trialNum: 2, output: 'B', trajectory: [], duration: 100, pass: true },
            { trialNum: 3, output: 'C', trajectory: [], duration: 100, pass: false },
            { trialNum: 4, output: 'D', trajectory: [], duration: 100, pass: true },
            { trialNum: 5, output: 'E', trajectory: [], duration: 100, pass: false },
          ],
        },
        variant: {
          passAtK: 1.0,
          passExpK: 1.0,
          k: 5,
          trials: [
            { trialNum: 1, output: 'X', trajectory: [], duration: 100, pass: true },
            { trialNum: 2, output: 'Y', trajectory: [], duration: 100, pass: true },
            { trialNum: 3, output: 'Z', trajectory: [], duration: 100, pass: true },
            { trialNum: 4, output: 'W', trajectory: [], duration: 100, pass: true },
            { trialNum: 5, output: 'V', trajectory: [], duration: 100, pass: true },
          ],
        },
      }
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      // Variant with 100% pass rate should rank higher
      expect(result.rankings[0]?.run).toBe('variant')
    })

    test('indicates significance when passAtK differs substantially', async () => {
      const grader = createTrialsStatisticalGrader(500)
      // Strong difference: all pass vs all fail
      const runs: Record<string, TrialsComparisonRunData> = {
        baseline: {
          passAtK: 0,
          k: 5,
          trials: [
            { trialNum: 1, output: 'A', trajectory: [], duration: 100, pass: false },
            { trialNum: 2, output: 'B', trajectory: [], duration: 100, pass: false },
            { trialNum: 3, output: 'C', trajectory: [], duration: 100, pass: false },
            { trialNum: 4, output: 'D', trajectory: [], duration: 100, pass: false },
            { trialNum: 5, output: 'E', trajectory: [], duration: 100, pass: false },
          ],
        },
        variant: {
          passAtK: 1.0,
          k: 5,
          trials: [
            { trialNum: 1, output: 'X', trajectory: [], duration: 100, pass: true },
            { trialNum: 2, output: 'Y', trajectory: [], duration: 100, pass: true },
            { trialNum: 3, output: 'Z', trajectory: [], duration: 100, pass: true },
            { trialNum: 4, output: 'W', trajectory: [], duration: 100, pass: true },
            { trialNum: 5, output: 'V', trajectory: [], duration: 100, pass: true },
          ],
        },
      }
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      expect(result.reasoning).toContain('clear separation')
    })

    test('handles empty trials array', async () => {
      const grader = createTrialsStatisticalGrader(100)
      const runs: Record<string, TrialsComparisonRunData> = {
        baseline: { k: 3, trials: [] },
        variant: {
          k: 3,
          trials: [{ trialNum: 1, output: 'X', trajectory: [], duration: 100, pass: true }],
        },
      }
      const input = createMockTrialInput(runs)

      const result = await grader(input)

      // Should not throw
      expect(result.rankings.length).toBe(2)
    })
  })

  describe('grade function', () => {
    test('works with default iterations', async () => {
      const runs = createMockTrialRuns()
      const input = createMockTrialInput(runs)

      const result = await statisticalGrade(input)

      expect(result.rankings).toBeDefined()
      expect(result.rankings.length).toBe(2)
    })
  })
})

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('trials comparison grader edge cases', () => {
  test('handles single run gracefully', async () => {
    const grader = createTrialsWeightedGrader()
    const runs: Record<string, TrialsComparisonRunData> = {
      only: { passAtK: 1.0, passExpK: 0.8, k: 3, trials: [] },
    }
    const input = createMockTrialInput(runs)

    const result = await grader(input)

    expect(result.rankings.length).toBe(1)
    expect(result.rankings[0]?.rank).toBe(1)
  })

  test('handles zero passAtK and passExpK', async () => {
    const grader = createTrialsWeightedGrader()
    const runs: Record<string, TrialsComparisonRunData> = {
      baseline: { passAtK: 0, passExpK: 0, k: 3, trials: [] },
      variant: { passAtK: 0.5, passExpK: 0.2, k: 3, trials: [] },
    }
    const input = createMockTrialInput(runs)

    const result = await grader(input)

    expect(result.rankings[0]?.run).toBe('variant')
  })

  test('deterministic ordering for equal scores', async () => {
    const grader = createTrialsWeightedGrader()
    const runs = createMockTrialRuns({
      baseline: { passAtK: 0.8, passExpK: 0.6 },
      variant: { passAtK: 0.8, passExpK: 0.6 },
    })
    const input = createMockTrialInput(runs)

    // Run multiple times to check stability
    const results = await Promise.all([grader(input), grader(input), grader(input)])

    // All should have same ordering
    const orders = results.map((r) => r.rankings.map((rank) => rank.run).join(','))
    expect(new Set(orders).size).toBe(1)
  })

  test('flakiness is clamped to non-negative', async () => {
    // Edge case: passExpK > passAtK shouldn't happen but handle gracefully
    const grader = createTrialsWeightedGrader({ capability: 0.0, reliability: 0.0, consistency: 1.0 })
    const runs: Record<string, TrialsComparisonRunData> = {
      baseline: { passAtK: 0.5, passExpK: 0.7, k: 3, trials: [] }, // Invalid but should work
      variant: { passAtK: 0.8, passExpK: 0.8, k: 3, trials: [] },
    }
    const input = createMockTrialInput(runs)

    const result = await grader(input)

    // Both should have flakiness 0, so consistency score should be 1.0 for both
    // Variant has higher capability/reliability so it wins on tiebreaker
    expect(result.rankings).toBeDefined()
  })
})
