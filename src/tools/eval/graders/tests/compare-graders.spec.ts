/**
 * Unit tests for built-in comparison graders.
 *
 * @remarks
 * Tests for:
 * - compare-weighted: Configurable weight grader
 * - compare-statistical: Bootstrap confidence interval grader
 *
 * @packageDocumentation
 */

import { describe, expect, test } from 'bun:test'
import type { ComparisonGraderInput, ComparisonRunData } from '../../pipeline/pipeline.types.ts'
import { createStatisticalGrader, grade as statisticalGrade } from '../compare-statistical.ts'
import { createWeightedGrader, DEFAULT_WEIGHTS, type Weights } from '../compare-weighted.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockRuns = (
  overrides: Partial<Record<string, Partial<ComparisonRunData>>> = {},
): Record<string, ComparisonRunData> => ({
  baseline: {
    output: 'Result A',
    score: { pass: true, score: 0.8 },
    duration: 1000,
    toolErrors: false,
    ...overrides.baseline,
  },
  variant: {
    output: 'Result B',
    score: { pass: true, score: 0.9 },
    duration: 1500,
    toolErrors: false,
    ...overrides.variant,
  },
})

const createMockInput = (runs: Record<string, ComparisonRunData>): ComparisonGraderInput => ({
  id: 'test-001',
  input: 'Test prompt',
  hint: 'Expected output',
  runs,
})

// ============================================================================
// Weighted Grader Tests
// ============================================================================

describe('compare-weighted grader', () => {
  describe('DEFAULT_WEIGHTS', () => {
    test('has expected default values', () => {
      expect(DEFAULT_WEIGHTS.quality).toBe(0.5)
      expect(DEFAULT_WEIGHTS.latency).toBe(0.3)
      expect(DEFAULT_WEIGHTS.reliability).toBe(0.2)
    })

    test('weights sum to 1.0', () => {
      const sum = DEFAULT_WEIGHTS.quality + DEFAULT_WEIGHTS.latency + DEFAULT_WEIGHTS.reliability
      expect(sum).toBe(1.0)
    })
  })

  describe('createWeightedGrader', () => {
    test('returns higher rank for better quality score', async () => {
      const grader = createWeightedGrader({ quality: 1.0, latency: 0.0, reliability: 0.0 })
      const runs = createMockRuns({
        baseline: { score: { pass: true, score: 0.7 } },
        variant: { score: { pass: true, score: 0.9 } },
      })
      const input = createMockInput(runs)

      const result = await grader(input)

      expect(result.rankings.length).toBe(2)
      expect(result.rankings[0]?.run).toBe('variant')
      expect(result.rankings[0]?.rank).toBe(1)
      expect(result.rankings[1]?.run).toBe('baseline')
      expect(result.rankings[1]?.rank).toBe(2)
    })

    test('returns higher rank for lower latency when latency weight is high', async () => {
      const grader = createWeightedGrader({ quality: 0.0, latency: 1.0, reliability: 0.0 })
      const runs = createMockRuns({
        baseline: { duration: 500, score: { pass: true, score: 0.5 } },
        variant: { duration: 2000, score: { pass: true, score: 0.9 } },
      })
      const input = createMockInput(runs)

      const result = await grader(input)

      // Faster run should win when latency is all that matters
      expect(result.rankings[0]?.run).toBe('baseline')
    })

    test('penalizes runs with tool errors when reliability weight is high', async () => {
      const grader = createWeightedGrader({ quality: 0.0, latency: 0.0, reliability: 1.0 })
      const runs = createMockRuns({
        baseline: { toolErrors: false },
        variant: { toolErrors: true },
      })
      const input = createMockInput(runs)

      const result = await grader(input)

      expect(result.rankings[0]?.run).toBe('baseline')
      expect(result.rankings[1]?.run).toBe('variant')
    })

    test('includes weights in reasoning', async () => {
      const weights: Weights = { quality: 0.6, latency: 0.3, reliability: 0.1 }
      const grader = createWeightedGrader(weights)
      const input = createMockInput(createMockRuns())

      const result = await grader(input)

      expect(result.reasoning).toContain('quality=0.6')
      expect(result.reasoning).toContain('latency=0.3')
      expect(result.reasoning).toContain('reliability=0.1')
    })

    test('handles missing score gracefully', async () => {
      const grader = createWeightedGrader()
      const runs: Record<string, ComparisonRunData> = {
        baseline: { output: 'A' },
        variant: { output: 'B', score: { pass: true, score: 0.8 } },
      }
      const input = createMockInput(runs)

      const result = await grader(input)

      // Should not throw, variant should rank higher due to having a score
      expect(result.rankings.length).toBe(2)
      expect(result.rankings[0]?.run).toBe('variant')
    })

    test('handles three or more runs', async () => {
      const grader = createWeightedGrader()
      const runs: Record<string, ComparisonRunData> = {
        a: { output: 'A', score: { pass: true, score: 0.9 }, duration: 1000, toolErrors: false },
        b: { output: 'B', score: { pass: true, score: 0.7 }, duration: 800, toolErrors: false },
        c: { output: 'C', score: { pass: false, score: 0.5 }, duration: 500, toolErrors: true },
      }
      const input = createMockInput(runs)

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

describe('compare-statistical grader', () => {
  describe('createStatisticalGrader', () => {
    test('returns rankings based on score means', async () => {
      const grader = createStatisticalGrader(100)
      const runs = createMockRuns({
        baseline: { score: { pass: true, score: 0.6 } },
        variant: { score: { pass: true, score: 0.9 } },
      })
      const input = createMockInput(runs)

      const result = await grader(input)

      expect(result.rankings.length).toBe(2)
      expect(result.rankings[0]?.run).toBe('variant')
    })

    test('handles missing scores as zero', async () => {
      const grader = createStatisticalGrader(100)
      const runs: Record<string, ComparisonRunData> = {
        baseline: { output: 'A' },
        variant: { output: 'B', score: { pass: true, score: 0.8 } },
      }
      const input = createMockInput(runs)

      const result = await grader(input)

      expect(result.rankings[0]?.run).toBe('variant')
    })

    test('indicates significance when scores differ (single samples have no variance)', async () => {
      const grader = createStatisticalGrader(100)
      const runs = createMockRuns({
        baseline: { score: { pass: true, score: 0.8 } },
        variant: { score: { pass: true, score: 0.81 } },
      })
      const input = createMockInput(runs)

      const result = await grader(input)

      // Note: With single samples, bootstrap has no variance.
      // CIs are [0.8, 0.8] and [0.81, 0.81] - non-overlapping.
      // Statistical significance test is most meaningful with multiple samples.
      expect(result.reasoning).toContain('statistically significant')
    })

    test('indicates non-significance when scores are identical', async () => {
      const grader = createStatisticalGrader(100)
      const runs = createMockRuns({
        baseline: { score: { pass: true, score: 0.8 } },
        variant: { score: { pass: true, score: 0.8 } },
      })
      const input = createMockInput(runs)

      const result = await grader(input)

      // Identical scores = overlapping CIs = not significant
      expect(result.reasoning).toContain('No statistically significant difference')
    })
  })

  describe('grade function', () => {
    test('works with default iterations', async () => {
      const runs = createMockRuns()
      const input = createMockInput(runs)

      const result = await statisticalGrade(input)

      expect(result.rankings).toBeDefined()
      expect(result.rankings.length).toBe(2)
    })
  })
})

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('comparison grader edge cases', () => {
  test('handles single run gracefully', async () => {
    const grader = createWeightedGrader()
    const runs: Record<string, ComparisonRunData> = {
      only: { output: 'Only run', score: { pass: true, score: 1.0 } },
    }
    const input = createMockInput(runs)

    const result = await grader(input)

    expect(result.rankings.length).toBe(1)
    expect(result.rankings[0]?.rank).toBe(1)
  })

  test('handles empty trajectory', async () => {
    const grader = createWeightedGrader()
    const runs = createMockRuns({
      baseline: { trajectory: [] },
      variant: { trajectory: undefined },
    })
    const input = createMockInput(runs)

    const result = await grader(input)

    expect(result.rankings.length).toBe(2)
  })

  test('handles zero duration', async () => {
    const grader = createWeightedGrader({ quality: 0.0, latency: 1.0, reliability: 0.0 })
    const runs = createMockRuns({
      baseline: { duration: 0 },
      variant: { duration: 1000 },
    })
    const input = createMockInput(runs)

    const result = await grader(input)

    // Zero duration should get highest latency score
    expect(result.rankings[0]?.run).toBe('baseline')
  })

  test('deterministic ordering for equal scores', async () => {
    const grader = createWeightedGrader()
    const runs = createMockRuns({
      baseline: { score: { pass: true, score: 0.8 }, duration: 1000, toolErrors: false },
      variant: { score: { pass: true, score: 0.8 }, duration: 1000, toolErrors: false },
    })
    const input = createMockInput(runs)

    // Run multiple times to check stability
    const results = await Promise.all([grader(input), grader(input), grader(input)])

    // All should have same ordering
    const orders = results.map((r) => r.rankings.map((rank) => rank.run).join(','))
    expect(new Set(orders).size).toBe(1)
  })
})
