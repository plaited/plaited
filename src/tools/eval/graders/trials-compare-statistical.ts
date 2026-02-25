/**
 * Built-in statistical significance comparison grader for trials data.
 *
 * @remarks
 * Uses bootstrap sampling to compute confidence intervals for passAtK and passExpK.
 * Flags when the winner is statistically significant (p<0.05, non-overlapping CIs).
 *
 * Unlike the capture statistical grader which only has one score per prompt,
 * trials data has multiple trial results per prompt, enabling proper bootstrap
 * variance estimation.
 *
 * Bootstrap iterations can be customized via environment variable:
 * - `COMPARE_BOOTSTRAP_ITERATIONS` (default: 1000)
 *
 * @packageDocumentation
 */

import type {
  ComparisonGraderResult,
  TrialsComparisonGrader,
  TrialsComparisonGraderInput,
} from '../pipeline/pipeline.types.ts'
import { DEFAULT_ITERATIONS, getBootstrapConfigFromEnv } from './bootstrap.ts'

/**
 * Bootstrap confidence interval result.
 */
type BootstrapResult = {
  /** Median estimate from bootstrap samples (more robust than mean) */
  median: number
  /** 95% confidence interval [lower, upper] */
  ci95: [number, number]
}

/**
 * Compute passAtK estimate from trial pass/fail samples via bootstrap.
 *
 * @remarks
 * passAtK = 1 - (1 - p)^k where p is estimated pass rate.
 * We bootstrap the pass rate and compute passAtK from each bootstrap sample.
 *
 * @param trials - Array of 0/1 values (0=fail, 1=pass)
 * @param k - Number of trials
 * @param iterations - Number of bootstrap iterations
 * @returns Bootstrap estimate and CI for passAtK
 */
const bootstrapPassAtK = (trials: number[], k: number, iterations: number): BootstrapResult => {
  if (trials.length === 0) {
    return { median: 0, ci95: [0, 0] }
  }

  const passAtKValues: number[] = []

  for (let i = 0; i < iterations; i++) {
    // Resample with replacement
    const resampled = Array.from(
      { length: trials.length },
      () => trials[Math.floor(Math.random() * trials.length)] as number,
    )

    // Compute pass rate from resample
    const passRate = resampled.reduce((acc, val) => acc + val, 0) / resampled.length

    // Compute passAtK: probability of at least one pass in k samples
    // passAtK = 1 - (1 - p)^k
    const passAtK = 1 - (1 - passRate) ** k
    passAtKValues.push(passAtK)
  }

  // Sort for percentile calculation
  passAtKValues.sort((a, b) => a - b)

  const lowerIdx = Math.floor(iterations * 0.025)
  const upperIdx = Math.floor(iterations * 0.975)

  return {
    median: passAtKValues[Math.floor(iterations / 2)] ?? 0,
    ci95: [passAtKValues[lowerIdx] ?? 0, passAtKValues[upperIdx] ?? 0],
  }
}

/**
 * Get bootstrap iterations from environment or use default.
 *
 * @returns Number of bootstrap iterations
 */
const getIterations = (): number => {
  const config = getBootstrapConfigFromEnv()
  return config.iterations ?? DEFAULT_ITERATIONS
}

/**
 * Statistical significance trials comparison grader.
 *
 * @remarks
 * Compares runs using bootstrap sampling on trial outcomes to determine
 * if differences in passAtK are statistically significant.
 *
 * Unlike single-sample comparisons, trials data provides multiple samples
 * per prompt (k trials), enabling meaningful variance estimation.
 *
 * @public
 */
export const grade: TrialsComparisonGrader = async ({
  runs,
}: TrialsComparisonGraderInput): Promise<ComparisonGraderResult> => {
  const iterations = getIterations()

  // Collect pass/fail outcomes for each run
  const runStats = Object.entries(runs).map(([label, run]) => {
    // Convert trials to 0/1 array
    const trialOutcomes = run.trials.map((t) => (t.pass ? 1 : 0))

    // Bootstrap passAtK estimate
    const stats = bootstrapPassAtK(trialOutcomes, run.k, iterations)

    return { label, passAtK: run.passAtK ?? 0, stats }
  })

  // Sort by bootstrap median passAtK descending
  const sorted = runStats.sort((a, b) => b.stats.median - a.stats.median)

  // Check if winner is statistically significant
  // CIs don't overlap = significant difference (approximately p<0.05)
  let isSignificant = false
  const first = sorted[0]
  const second = sorted[1]
  if (first && second) {
    // Non-overlapping: first's lower bound > second's upper bound
    isSignificant = first.stats.ci95[0] > second.stats.ci95[1]
  }

  const reasoning = isSignificant
    ? `Winner "${first?.label}" shows clear separation (non-overlapping 95% CIs for passAtK)`
    : 'No clear winner - confidence intervals overlap between top runs'

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
 * @returns Trials comparison grader function
 *
 * @public
 */
export const createTrialsStatisticalGrader = (iterations: number = DEFAULT_ITERATIONS): TrialsComparisonGrader => {
  return async ({ runs }: TrialsComparisonGraderInput): Promise<ComparisonGraderResult> => {
    const runStats = Object.entries(runs).map(([label, run]) => {
      const trialOutcomes = run.trials.map((t) => (t.pass ? 1 : 0))
      const stats = bootstrapPassAtK(trialOutcomes, run.k, iterations)
      return { label, passAtK: run.passAtK ?? 0, stats }
    })

    const sorted = runStats.sort((a, b) => b.stats.median - a.stats.median)

    let isSignificant = false
    const first = sorted[0]
    const second = sorted[1]
    if (first && second) {
      isSignificant = first.stats.ci95[0] > second.stats.ci95[1]
    }

    return {
      rankings: sorted.map((s, i) => ({
        run: s.label,
        rank: i + 1,
        score: s.stats.median,
      })),
      reasoning: isSignificant
        ? `Winner "${first?.label}" shows clear separation (non-overlapping 95% CIs)`
        : 'No clear winner - confidence intervals overlap between top runs',
    }
  }
}
