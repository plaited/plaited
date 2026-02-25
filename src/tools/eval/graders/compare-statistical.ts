/**
 * Built-in statistical significance comparison grader.
 *
 * @remarks
 * Uses bootstrap sampling to compute confidence intervals for score estimates.
 * Flags when the winner is statistically significant (p<0.05, non-overlapping CIs).
 *
 * Bootstrap iterations can be customized via environment variable:
 * - `COMPARE_BOOTSTRAP_ITERATIONS` (default: 1000)
 *
 * @packageDocumentation
 */

import type { ComparisonGrader, ComparisonGraderInput, ComparisonGraderResult } from '../pipeline/pipeline.types.ts'
import { bootstrap, getBootstrapConfigFromEnv } from './bootstrap.ts'

/**
 * Statistical significance comparison grader.
 *
 * @remarks
 * Compares runs using bootstrap sampling to determine if differences
 * are statistically significant. When confidence intervals don't overlap,
 * the difference is flagged as significant (p<0.05).
 *
 * **Single-sample limitation:** When comparing individual prompts, each run
 * provides only one score sample. Bootstrap with a single sample yields a
 * degenerate CI of `[value, value]`. This grader is most useful when:
 * - Aggregating results across multiple prompts
 * - Using with the full comparison report (which combines per-prompt comparisons)
 *
 * For single-prompt comparisons, consider the weighted grader instead.
 *
 * @public
 */
export const grade: ComparisonGrader = async ({ runs }: ComparisonGraderInput): Promise<ComparisonGraderResult> => {
  const config = getBootstrapConfigFromEnv()

  // Collect scores for each run
  const runStats = Object.entries(runs).map(([label, run]) => {
    // Use grader score if available, otherwise 0
    const score = run.score?.score ?? 0

    // For single-prompt comparison, we only have one sample
    // In practice, this grader is most useful when aggregating across prompts
    const stats = bootstrap([score], config)

    return { label, score, stats }
  })

  // Sort by bootstrap median descending
  const sorted = runStats.sort((a, b) => b.stats.median - a.stats.median)

  // Check if winner is statistically significant
  // CIs don't overlap = significant difference (approximately p<0.05)
  let isSignificant = false
  const first = sorted[0]
  const second = sorted[1]
  if (first && second) {
    // Non-overlapping: first's lower bound > second's upper bound
    isSignificant = first.stats.ci[0] > second.stats.ci[1]
  }

  const reasoning = isSignificant
    ? `Winner "${first?.label}" is statistically significant (p<0.05, non-overlapping 95% CIs)`
    : 'No statistically significant difference between top runs (overlapping 95% CIs)'

  return {
    rankings: sorted.map((s, i) => ({
      run: s.label,
      rank: i + 1,
      score: s.stats.median,
    })),
    reasoning,
  }
}

/**
 * Create a statistical grader with custom iteration count.
 *
 * @param iterations - Number of bootstrap iterations
 * @returns Comparison grader function
 *
 * @public
 */
export const createStatisticalGrader = (iterations?: number): ComparisonGrader => {
  const config = iterations ? { iterations } : getBootstrapConfigFromEnv()

  return async ({ runs }: ComparisonGraderInput): Promise<ComparisonGraderResult> => {
    const runStats = Object.entries(runs).map(([label, run]) => {
      const score = run.score?.score ?? 0
      const stats = bootstrap([score], config)
      return { label, score, stats }
    })

    const sorted = runStats.sort((a, b) => b.stats.median - a.stats.median)

    let isSignificant = false
    const first = sorted[0]
    const second = sorted[1]
    if (first && second) {
      isSignificant = first.stats.ci[0] > second.stats.ci[1]
    }

    return {
      rankings: sorted.map((s, i) => ({
        run: s.label,
        rank: i + 1,
        score: s.stats.median,
      })),
      reasoning: isSignificant
        ? `Winner "${first?.label}" is statistically significant (p<0.05)`
        : 'No statistically significant difference between top runs',
    }
  }
}
