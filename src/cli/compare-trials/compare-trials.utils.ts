/** @public */
export const mean = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** @public */
export const median = (values: number[]): number => {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
}

/** @public */
export const bootstrap = (
  values: number[],
  statFn: (samples: number[]) => number = mean,
  options: { resamples?: number; confidence?: number } = {},
): [number, number] => {
  const { resamples = 1000, confidence = 0.95 } = options

  if (values.length === 0) return [0, 0]
  if (values.length === 1) return [values[0] ?? 0, values[0] ?? 0]

  const stats: number[] = []
  for (let i = 0; i < resamples; i += 1) {
    const sample = Array.from({ length: values.length }, () => values[Math.floor(Math.random() * values.length)] ?? 0)
    stats.push(statFn(sample))
  }

  stats.sort((a, b) => a - b)

  const alpha = (1 - confidence) / 2
  const lower = stats[Math.floor(alpha * stats.length)] ?? 0
  const upper = stats[Math.floor((1 - alpha) * stats.length)] ?? 0

  return [lower, upper]
}
