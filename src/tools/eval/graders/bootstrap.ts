/**
 * Shared bootstrap sampling utilities for confidence interval computation.
 *
 * @remarks
 * Bootstrap resampling provides robust confidence intervals without
 * assuming a specific distribution. For small samples, it's more
 * reliable than parametric methods.
 *
 * Environment variable configuration:
 * - `COMPARE_BOOTSTRAP_ITERATIONS` (default: 1000)
 *
 * @packageDocumentation
 */

/** Default number of bootstrap iterations */
export const DEFAULT_ITERATIONS = 1000

/** Default confidence level (95%) */
export const DEFAULT_CONFIDENCE_LEVEL = 0.95

/**
 * Confidence interval as [lower, upper] bounds.
 */
export type ConfidenceInterval = [number, number]

/**
 * Bootstrap confidence interval result.
 */
export type BootstrapResult = {
  /** Median of bootstrap sample means (50th percentile) */
  median: number
  /** Confidence interval [lower, upper] */
  ci: ConfidenceInterval
}

/**
 * Configuration for bootstrap sampling.
 */
export type BootstrapConfig = {
  /** Number of bootstrap iterations (default: 1000) */
  iterations?: number
  /** Confidence level between 0 and 1 (default: 0.95) */
  confidenceLevel?: number
}

/**
 * Compute bootstrap confidence interval for sample mean.
 *
 * @remarks
 * Bootstrap resampling provides robust confidence intervals without
 * assuming a specific distribution. For small samples, it's more
 * reliable than parametric methods.
 *
 * @param samples - Array of numeric samples
 * @param config - Optional bootstrap configuration
 * @returns Bootstrap median and confidence interval
 *
 * @public
 */
export const bootstrap = (samples: number[], config?: BootstrapConfig): BootstrapResult => {
  const iterations = config?.iterations ?? DEFAULT_ITERATIONS
  const confidenceLevel = config?.confidenceLevel ?? DEFAULT_CONFIDENCE_LEVEL

  if (samples.length === 0) {
    return { median: 0, ci: [0, 0] }
  }

  if (samples.length === 1) {
    const value = samples[0] ?? 0
    return { median: value, ci: [value, value] }
  }

  const means: number[] = []

  for (let i = 0; i < iterations; i++) {
    // Resample with replacement - we know samples.length > 1 at this point
    const resampled = Array.from(
      { length: samples.length },
      () => samples[Math.floor(Math.random() * samples.length)] as number,
    )

    // Compute mean of resampled data
    const sum = resampled.reduce((acc, val) => acc + val, 0)
    means.push(sum / resampled.length)
  }

  // Sort means for percentile calculation
  means.sort((a, b) => a - b)

  // Compute percentile indices based on confidence level
  // For 95% CI: lower = 2.5th percentile, upper = 97.5th percentile
  const alpha = (1 - confidenceLevel) / 2
  const lowerIdx = Math.floor(iterations * alpha)
  const upperIdx = Math.floor(iterations * (1 - alpha))

  return {
    median: means[Math.floor(iterations / 2)] ?? 0,
    ci: [means[lowerIdx] ?? 0, means[upperIdx] ?? 0],
  }
}

/**
 * Format confidence interval as string.
 *
 * @param ci - Confidence interval [lower, upper]
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted CI string or empty string if undefined
 *
 * @public
 */
export const formatCI = (ci: ConfidenceInterval | undefined, decimals: number = 3): string => {
  if (!ci) return ''
  return `[${ci[0].toFixed(decimals)}, ${ci[1].toFixed(decimals)}]`
}

/**
 * Get bootstrap configuration from environment variables.
 *
 * @remarks
 * Reads configuration from:
 * - `COMPARE_BOOTSTRAP_ITERATIONS`: Number of iterations (min: 100)
 *
 * @returns Bootstrap configuration
 *
 * @public
 */
export const getBootstrapConfigFromEnv = (): BootstrapConfig => {
  const envValue = process.env.COMPARE_BOOTSTRAP_ITERATIONS
  if (!envValue) return { iterations: DEFAULT_ITERATIONS }

  const parsed = Number.parseInt(envValue, 10)
  const iterations = Number.isNaN(parsed) || parsed < 100 ? DEFAULT_ITERATIONS : parsed

  return { iterations }
}
