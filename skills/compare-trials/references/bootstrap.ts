/**
 * Bootstrap sampling utility for confidence intervals.
 *
 * @remarks
 * Reusable bootstrap function — computes confidence intervals for any
 * numeric metric by resampling with replacement.
 */

/**
 * Compute bootstrap confidence interval for a metric.
 *
 * @param values - Array of observed metric values
 * @param statFn - Function to compute the statistic (default: mean)
 * @param options - Bootstrap configuration
 * @returns [lower, upper] confidence interval bounds
 */
export const bootstrap = (
  values: number[],
  statFn: (samples: number[]) => number = mean,
  options: { resamples?: number; confidence?: number } = {},
): [number, number] => {
  const { resamples = 1000, confidence = 0.95 } = options

  if (values.length === 0) return [0, 0]
  if (values.length === 1) return [values[0] ?? 0, values[0] ?? 0]

  const stats: number[] = []

  for (let i = 0; i < resamples; i++) {
    const sample = Array.from({ length: values.length }, () => {
      const v = values[Math.floor(Math.random() * values.length)]
      return v ?? 0
    })
    stats.push(statFn(sample))
  }

  stats.sort((a, b) => a - b)

  const alpha = (1 - confidence) / 2
  const lower = stats[Math.floor(alpha * stats.length)] ?? 0
  const upper = stats[Math.floor((1 - alpha) * stats.length)] ?? 0

  return [lower, upper]
}

/** Compute mean of an array */
export const mean = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Compute median of a sorted array */
export const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
}
