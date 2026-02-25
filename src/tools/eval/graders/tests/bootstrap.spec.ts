/**
 * Unit tests for bootstrap sampling utilities.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { bootstrap, DEFAULT_CONFIDENCE_LEVEL, DEFAULT_ITERATIONS, getBootstrapConfigFromEnv } from '../bootstrap.ts'

describe('bootstrap', () => {
  describe('edge cases', () => {
    test('returns {median: 0, ci: [0, 0]} for empty array', () => {
      const result = bootstrap([])
      expect(result.median).toBe(0)
      expect(result.ci).toEqual([0, 0])
    })

    test('returns {median: value, ci: [value, value]} for single sample', () => {
      const result = bootstrap([0.75])
      expect(result.median).toBe(0.75)
      expect(result.ci).toEqual([0.75, 0.75])
    })

    test('handles single sample of 0', () => {
      const result = bootstrap([0])
      expect(result.median).toBe(0)
      expect(result.ci).toEqual([0, 0])
    })

    test('handles single sample of 1', () => {
      const result = bootstrap([1])
      expect(result.median).toBe(1)
      expect(result.ci).toEqual([1, 1])
    })
  })

  describe('confidence interval bounds', () => {
    test('CI lower bound <= median <= CI upper bound', () => {
      const samples = [0.5, 0.6, 0.7, 0.8, 0.9]
      const result = bootstrap(samples, { iterations: 1000 })

      expect(result.ci[0]).toBeLessThanOrEqual(result.median)
      expect(result.median).toBeLessThanOrEqual(result.ci[1])
    })

    test('CI contains the true median for uniform samples', () => {
      // For identical samples, CI should collapse to the value
      const samples = [0.5, 0.5, 0.5, 0.5, 0.5]
      const result = bootstrap(samples, { iterations: 1000 })

      expect(result.median).toBeCloseTo(0.5, 2)
      expect(result.ci[0]).toBeCloseTo(0.5, 2)
      expect(result.ci[1]).toBeCloseTo(0.5, 2)
    })

    test('CI widens with more variance in samples', () => {
      const lowVariance = [0.49, 0.5, 0.51]
      const highVariance = [0.1, 0.5, 0.9]

      const lowResult = bootstrap(lowVariance, { iterations: 1000 })
      const highResult = bootstrap(highVariance, { iterations: 1000 })

      const lowWidth = lowResult.ci[1] - lowResult.ci[0]
      const highWidth = highResult.ci[1] - highResult.ci[0]

      expect(highWidth).toBeGreaterThan(lowWidth)
    })
  })

  describe('configuration', () => {
    test('uses default iterations when not specified', () => {
      // Just verify it runs without error with defaults
      const result = bootstrap([0.5, 0.6, 0.7])
      expect(result.median).toBeGreaterThan(0)
    })

    test('accepts custom iteration count', () => {
      const result = bootstrap([0.5, 0.6, 0.7], { iterations: 100 })
      expect(result.median).toBeGreaterThan(0)
    })

    test('accepts custom confidence level', () => {
      const samples = [0.3, 0.4, 0.5, 0.6, 0.7]

      // 90% CI should be narrower than 95% CI
      const ci90 = bootstrap(samples, { iterations: 1000, confidenceLevel: 0.9 })
      const ci95 = bootstrap(samples, { iterations: 1000, confidenceLevel: 0.95 })

      const width90 = ci90.ci[1] - ci90.ci[0]
      const width95 = ci95.ci[1] - ci95.ci[0]

      // 95% CI should generally be wider than 90% CI
      // Allow some tolerance due to randomness
      expect(width95).toBeGreaterThanOrEqual(width90 * 0.8)
    })
  })

  describe('statistical properties', () => {
    test('median is close to sample mean', () => {
      const samples = [0.2, 0.4, 0.6, 0.8, 1.0]
      const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length

      const result = bootstrap(samples, { iterations: 10000 })

      // Bootstrap median should be close to sample mean for symmetric distributions
      expect(result.median).toBeCloseTo(sampleMean, 1)
    })

    test('is deterministic-ish for large iteration counts', () => {
      const samples = [0.3, 0.5, 0.7]

      // With many iterations, results should be similar across runs
      const result1 = bootstrap(samples, { iterations: 10000 })
      const result2 = bootstrap(samples, { iterations: 10000 })

      expect(result1.median).toBeCloseTo(result2.median, 1)
    })
  })
})

describe('getBootstrapConfigFromEnv', () => {
  const originalEnv = process.env.COMPARE_BOOTSTRAP_ITERATIONS

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.COMPARE_BOOTSTRAP_ITERATIONS
    } else {
      process.env.COMPARE_BOOTSTRAP_ITERATIONS = originalEnv
    }
  })

  test('returns default iterations when env var not set', () => {
    delete process.env.COMPARE_BOOTSTRAP_ITERATIONS
    const config = getBootstrapConfigFromEnv()
    expect(config.iterations).toBe(DEFAULT_ITERATIONS)
  })

  test('parses valid iteration count from env', () => {
    process.env.COMPARE_BOOTSTRAP_ITERATIONS = '5000'
    const config = getBootstrapConfigFromEnv()
    expect(config.iterations).toBe(5000)
  })

  test('returns default for invalid (non-numeric) env value', () => {
    process.env.COMPARE_BOOTSTRAP_ITERATIONS = 'invalid'
    const config = getBootstrapConfigFromEnv()
    expect(config.iterations).toBe(DEFAULT_ITERATIONS)
  })

  test('returns default for iteration count below minimum (100)', () => {
    process.env.COMPARE_BOOTSTRAP_ITERATIONS = '50'
    const config = getBootstrapConfigFromEnv()
    expect(config.iterations).toBe(DEFAULT_ITERATIONS)
  })

  test('accepts iteration count at minimum (100)', () => {
    process.env.COMPARE_BOOTSTRAP_ITERATIONS = '100'
    const config = getBootstrapConfigFromEnv()
    expect(config.iterations).toBe(100)
  })
})

describe('constants', () => {
  test('DEFAULT_ITERATIONS is 1000', () => {
    expect(DEFAULT_ITERATIONS).toBe(1000)
  })

  test('DEFAULT_CONFIDENCE_LEVEL is 0.95', () => {
    expect(DEFAULT_CONFIDENCE_LEVEL).toBe(0.95)
  })
})
