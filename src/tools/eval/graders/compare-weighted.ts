/**
 * Built-in weighted multi-dimensional comparison grader.
 *
 * @remarks
 * Configurable weights for quality, latency, and reliability.
 * Default strategy when no `--grader` is specified for the compare command.
 *
 * Weights can be customized via environment variables:
 * - `COMPARE_QUALITY` (default: 0.5)
 * - `COMPARE_LATENCY` (default: 0.3)
 * - `COMPARE_RELIABILITY` (default: 0.2)
 *
 * @packageDocumentation
 */

import type { ComparisonGrader, ComparisonGraderInput, ComparisonGraderResult } from '../pipeline/pipeline.types.ts'

/**
 * Weight configuration for comparison dimensions.
 */
export type Weights = {
  /** Weight for quality (pass/score) - how much correctness matters */
  quality: number
  /** Weight for latency - how much speed matters */
  latency: number
  /** Weight for reliability - how much error-free execution matters */
  reliability: number
}

/** Default weights: quality=0.5, latency=0.3, reliability=0.2 */
export const DEFAULT_WEIGHTS: Weights = {
  quality: 0.5,
  latency: 0.3,
  reliability: 0.2,
}

/**
 * Read weights from environment variables with fallback to defaults.
 *
 * @returns Weights configuration
 */
export const getWeightsFromEnv = (): Weights => {
  const quality = Number.parseFloat(process.env.COMPARE_QUALITY ?? String(DEFAULT_WEIGHTS.quality))
  const latency = Number.parseFloat(process.env.COMPARE_LATENCY ?? String(DEFAULT_WEIGHTS.latency))
  const reliability = Number.parseFloat(process.env.COMPARE_RELIABILITY ?? String(DEFAULT_WEIGHTS.reliability))

  return {
    quality: Number.isNaN(quality) ? DEFAULT_WEIGHTS.quality : quality,
    latency: Number.isNaN(latency) ? DEFAULT_WEIGHTS.latency : latency,
    reliability: Number.isNaN(reliability) ? DEFAULT_WEIGHTS.reliability : reliability,
  }
}

/**
 * Create a weighted comparison grader with custom weights.
 *
 * @param weights - Weight configuration for comparison dimensions
 * @returns Comparison grader function
 *
 * @public
 */
export const createWeightedGrader = (weights: Weights = DEFAULT_WEIGHTS): ComparisonGrader => {
  return async ({ runs }: ComparisonGraderInput): Promise<ComparisonGraderResult> => {
    const scores = Object.entries(runs).map(([label, run]) => {
      // Quality score: use grader score if available, otherwise 0
      // Note: run.score is only present if the result was graded
      const qualityScore = run.score?.score ?? 0

      // Latency score: inverse relationship (faster = better)
      // Normalize: 1 / (1 + duration/1000) gives ~0.5 at 1s, ~0.1 at 10s
      const duration = run.duration ?? 10000
      const latencyScore = 1 / (1 + duration / 1000)

      // Reliability score: 1 if no errors, 0 if errors
      const hasErrors = run.toolErrors ?? false
      const reliabilityScore = hasErrors ? 0 : 1

      // Weighted combination
      const weighted =
        qualityScore * weights.quality + latencyScore * weights.latency + reliabilityScore * weights.reliability

      return { label, weighted, qualityScore, latencyScore, reliabilityScore }
    })

    // Sort by weighted score descending (highest = best)
    const sorted = scores.sort((a, b) => b.weighted - a.weighted)

    return {
      rankings: sorted.map((s, i) => ({
        run: s.label,
        rank: i + 1,
        score: s.weighted,
      })),
      reasoning: `Weighted: quality=${weights.quality}, latency=${weights.latency}, reliability=${weights.reliability}`,
    }
  }
}

/**
 * Default weighted comparison grader using environment or default weights.
 *
 * @remarks
 * This is the default grader used when `--strategy weighted` is specified
 * or when no strategy is specified for the compare command.
 *
 * @public
 */
export const grade: ComparisonGrader = async (input: ComparisonGraderInput): Promise<ComparisonGraderResult> => {
  const weights = getWeightsFromEnv()
  const grader = createWeightedGrader(weights)
  return grader(input)
}
