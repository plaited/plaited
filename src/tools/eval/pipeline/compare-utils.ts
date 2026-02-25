/**
 * Shared utility functions for comparison modules.
 *
 * @remarks
 * Extracted from compare.ts and compare-trials.ts to avoid duplication.
 * Contains statistical helpers used by both CaptureResult and TrialResult comparisons.
 *
 * @packageDocumentation
 */

import type { LatencyStats, ScoreDistribution } from '../schemas.ts'

/**
 * Compute percentile from sorted array using nearest rank method.
 *
 * @remarks
 * Uses floor indexing (nearest rank method). For an array of length N,
 * returns the element at index `floor(N * p)`, clamped to the last element.
 * This does not interpolate between ranks.
 *
 * @param sorted - Sorted array of numbers
 * @param p - Percentile (0-1)
 * @returns Value at percentile
 *
 * @public
 */
export const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0
}

/**
 * Compute latency statistics from array of durations.
 *
 * @param durations - Array of durations in milliseconds
 * @returns Latency statistics
 *
 * @public
 */
export const computeLatencyStats = (durations: number[]): LatencyStats => {
  if (durations.length === 0) {
    return { p50: 0, p90: 0, p99: 0, mean: 0, min: 0, max: 0 }
  }

  const sorted = [...durations].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)

  return {
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
    mean: sum / sorted.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
  }
}

/**
 * Compute score distribution histogram.
 *
 * @param scores - Array of scores (0-1)
 * @returns Score distribution histogram
 *
 * @public
 */
export const computeScoreDistribution = (scores: number[]): ScoreDistribution => {
  const dist: ScoreDistribution = {
    '0.0-0.2': 0,
    '0.2-0.4': 0,
    '0.4-0.6': 0,
    '0.6-0.8': 0,
    '0.8-1.0': 0,
  }

  for (const score of scores) {
    if (score < 0.2) dist['0.0-0.2']++
    else if (score < 0.4) dist['0.2-0.4']++
    else if (score < 0.6) dist['0.4-0.6']++
    else if (score < 0.8) dist['0.6-0.8']++
    else dist['0.8-1.0']++
  }

  return dist
}
