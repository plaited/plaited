/**
 * Unit tests for compare-utils shared utilities.
 *
 * @remarks
 * Tests for percentile, computeLatencyStats, and computeScoreDistribution.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from 'bun:test'
import { computeLatencyStats, computeScoreDistribution, percentile } from '../compare-utils.ts'

// ============================================================================
// percentile Tests
// ============================================================================

describe('percentile', () => {
  test('computes correct percentile values', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    expect(percentile(sorted, 0.5)).toBe(60)
    expect(percentile(sorted, 0.25)).toBe(30)
    expect(percentile(sorted, 0.75)).toBe(80)
    expect(percentile(sorted, 0.9)).toBe(100)
  })

  test('returns 0 for empty array', () => {
    expect(percentile([], 0.5)).toBe(0)
  })

  test('handles single-element array', () => {
    expect(percentile([42], 0.5)).toBe(42)
    expect(percentile([42], 0.0)).toBe(42)
    expect(percentile([42], 1.0)).toBe(42)
  })

  test('handles p=0 and p=1 boundary values', () => {
    const sorted = [10, 20, 30]

    expect(percentile(sorted, 0)).toBe(10)
    expect(percentile(sorted, 1)).toBe(30)
  })
})

// ============================================================================
// computeLatencyStats Tests
// ============================================================================

describe('computeLatencyStats', () => {
  test('returns correct stats for typical durations', () => {
    const durations = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    const stats = computeLatencyStats(durations)

    expect(stats.min).toBe(100)
    expect(stats.max).toBe(1000)
    expect(stats.mean).toBe(550)
    expect(stats.p50).toBe(600)
    expect(stats.p90).toBe(1000)
  })

  test('returns zeros for empty array', () => {
    const stats = computeLatencyStats([])

    expect(stats.p50).toBe(0)
    expect(stats.p90).toBe(0)
    expect(stats.p99).toBe(0)
    expect(stats.mean).toBe(0)
    expect(stats.min).toBe(0)
    expect(stats.max).toBe(0)
  })

  test('handles single-element array', () => {
    const stats = computeLatencyStats([42])

    expect(stats.p50).toBe(42)
    expect(stats.p90).toBe(42)
    expect(stats.mean).toBe(42)
    expect(stats.min).toBe(42)
    expect(stats.max).toBe(42)
  })

  test('sorts unsorted input', () => {
    const stats = computeLatencyStats([500, 100, 300, 200, 400])

    expect(stats.min).toBe(100)
    expect(stats.max).toBe(500)
    expect(stats.mean).toBe(300)
  })
})

// ============================================================================
// computeScoreDistribution Tests
// ============================================================================

describe('computeScoreDistribution', () => {
  test('distributes scores into correct buckets', () => {
    const scores = [0.1, 0.3, 0.5, 0.7, 0.9]
    const dist = computeScoreDistribution(scores)

    expect(dist['0.0-0.2']).toBe(1)
    expect(dist['0.2-0.4']).toBe(1)
    expect(dist['0.4-0.6']).toBe(1)
    expect(dist['0.6-0.8']).toBe(1)
    expect(dist['0.8-1.0']).toBe(1)
  })

  test('handles empty scores array', () => {
    const dist = computeScoreDistribution([])

    expect(dist['0.0-0.2']).toBe(0)
    expect(dist['0.2-0.4']).toBe(0)
    expect(dist['0.4-0.6']).toBe(0)
    expect(dist['0.6-0.8']).toBe(0)
    expect(dist['0.8-1.0']).toBe(0)
  })

  test('handles boundary values correctly', () => {
    // 0.0 → first bucket, 0.2 → second bucket (not first), 1.0 → last bucket
    const scores = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    const dist = computeScoreDistribution(scores)

    expect(dist['0.0-0.2']).toBe(1) // 0.0
    expect(dist['0.2-0.4']).toBe(1) // 0.2
    expect(dist['0.4-0.6']).toBe(1) // 0.4
    expect(dist['0.6-0.8']).toBe(1) // 0.6
    expect(dist['0.8-1.0']).toBe(2) // 0.8, 1.0
  })
})
