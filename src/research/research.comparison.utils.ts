import { type NormalizedResearchPromptResult, normalizeResearchPromptResult } from './research.grading.utils.ts'
import type {
  ResearchPromotionDecision,
  ResearchPromptComparison,
  ResearchRun,
  ResearchRunComparison,
  ResearchRunMetrics,
} from './research.schema.ts'
import {
  ResearchPromotionDecisionSchema,
  type ResearchPromptWinner,
  ResearchRunComparisonSchema,
  ResearchRunMetricsSchema,
  ResearchRunSchema,
} from './research.schema.ts'

export const mean = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
}

export const bootstrap = (
  values: number[],
  statFn: (samples: number[]) => number = mean,
  options: { resamples?: number; confidence?: number } = {},
): [number, number] => {
  const { resamples = 1000, confidence = 0.95 } = options

  if (!Number.isInteger(resamples) || resamples <= 0) {
    throw new Error('bootstrap resamples must be a positive integer')
  }
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) {
    throw new Error('bootstrap confidence must be greater than 0 and less than 1')
  }

  if (values.length === 0) return [0, 0]
  if (values.length === 1) return [values[0] ?? 0, values[0] ?? 0]
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('bootstrap values must be finite numbers')
  }

  const stats: number[] = []
  for (let i = 0; i < resamples; i += 1) {
    const sample = Array.from({ length: values.length }, () => values[Math.floor(Math.random() * values.length)] ?? 0)
    const stat = statFn(sample)
    if (!Number.isFinite(stat)) {
      throw new Error('bootstrap statFn must return finite numbers')
    }
    stats.push(stat)
  }

  stats.sort((a, b) => a - b)

  const alpha = (1 - confidence) / 2
  const maxIndex = stats.length - 1
  const lowerIndex = Math.max(0, Math.min(maxIndex, Math.floor(alpha * maxIndex)))
  const upperIndex = Math.max(0, Math.min(maxIndex, Math.ceil((1 - alpha) * maxIndex)))
  const lower = stats[lowerIndex] ?? 0
  const upper = stats[upperIndex] ?? 0

  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) {
    throw new Error('bootstrap produced an invalid interval')
  }
  return [lower, upper]
}

const indexById = <T extends { result: { id: string } }>(results: T[]): Map<string, T> => {
  const resultMap = new Map<string, T>()
  for (const result of results) {
    resultMap.set(result.result.id, result)
  }
  return resultMap
}

const validateComparisonOptions = ({ confidence, resamples }: { confidence: number; resamples: number }): void => {
  if (!Number.isInteger(resamples) || resamples <= 0) {
    throw new Error('bootstrap resamples must be a positive integer')
  }
  if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) {
    throw new Error('bootstrap confidence must be greater than 0 and less than 1')
  }
}

const toComparableScore = (result?: NormalizedResearchPromptResult): number | null => {
  if (!result) return null
  if (!result.comparisonEligible) return null
  if (result.result.passAtK !== undefined) return result.result.passAtK
  if (result.result.passRate !== undefined) return result.result.passRate
  return null
}

const resolvePromptWinner = ({
  baseline,
  challenger,
}: {
  baseline: number | null
  challenger: number | null
}): ResearchPromptWinner => {
  if (baseline === null || challenger === null) {
    return 'insufficient_data'
  }
  if (baseline > challenger) {
    return 'baseline'
  }
  if (challenger > baseline) {
    return 'challenger'
  }
  return 'tie'
}

export const buildResearchRunMetrics = ({
  confidence,
  label,
  resamples,
  results,
}: {
  confidence: number
  label: string
  resamples: number
  results: NormalizedResearchPromptResult[]
}): ResearchRunMetrics => {
  const comparableResults = results.filter((result) => result.comparisonEligible)
  const passRates = comparableResults.flatMap((result) =>
    result.result.passRate === undefined ? [] : [result.result.passRate],
  )
  const passAtKs = comparableResults.flatMap((result) =>
    result.result.passAtK === undefined ? [] : [result.result.passAtK],
  )
  const durations = results.flatMap((result) => result.result.trials.map((trial) => trial.duration))

  return ResearchRunMetricsSchema.parse({
    label,
    promptCount: results.length,
    comparablePromptCount: comparableResults.length,
    avgPassRate: mean(passRates),
    avgPassAtK: mean(passAtKs),
    avgDuration: mean(durations),
    medianDuration: median(durations),
    passRateCI: bootstrap(passRates, mean, { resamples, confidence }),
    passAtKCI: bootstrap(passAtKs, mean, { resamples, confidence }),
  })
}

export const compareResearchRuns = ({
  baseline,
  challenger,
  confidence = 0.95,
  resamples = 1000,
}: {
  baseline: ResearchRun
  challenger: ResearchRun
  confidence?: number
  resamples?: number
}): ResearchRunComparison => {
  validateComparisonOptions({ confidence, resamples })
  const baselineRun = ResearchRunSchema.parse(baseline)
  const challengerRun = ResearchRunSchema.parse(challenger)
  const baselineResults = baselineRun.results.map(normalizeResearchPromptResult)
  const challengerResults = challengerRun.results.map(normalizeResearchPromptResult)

  const baselineIndex = indexById(baselineResults)
  const challengerIndex = indexById(challengerResults)
  const allIds = [...new Set([...baselineIndex.keys(), ...challengerIndex.keys()])].sort((a, b) => a.localeCompare(b))

  let baselineWins = 0
  let challengerWins = 0
  let ties = 0
  let insufficientData = 0

  const perPrompt: ResearchPromptComparison[] = allIds.map((id) => {
    const baselineResult = baselineIndex.get(id)
    const challengerResult = challengerIndex.get(id)
    const winner = resolvePromptWinner({
      baseline: toComparableScore(baselineResult),
      challenger: toComparableScore(challengerResult),
    })

    if (winner === 'baseline') baselineWins += 1
    if (winner === 'challenger') challengerWins += 1
    if (winner === 'tie') ties += 1
    if (winner === 'insufficient_data') insufficientData += 1

    return {
      id,
      baselinePassRate:
        baselineResult?.comparisonEligible && baselineResult.result.passRate !== undefined
          ? baselineResult.result.passRate
          : null,
      challengerPassRate:
        challengerResult?.comparisonEligible && challengerResult.result.passRate !== undefined
          ? challengerResult.result.passRate
          : null,
      baselinePassAtK:
        baselineResult?.comparisonEligible && baselineResult.result.passAtK !== undefined
          ? baselineResult.result.passAtK
          : null,
      challengerPassAtK:
        challengerResult?.comparisonEligible && challengerResult.result.passAtK !== undefined
          ? challengerResult.result.passAtK
          : null,
      winner,
    }
  })

  return ResearchRunComparisonSchema.parse({
    baseline: buildResearchRunMetrics({
      confidence,
      label: baselineRun.label,
      resamples,
      results: baselineResults,
    }),
    challenger: buildResearchRunMetrics({
      confidence,
      label: challengerRun.label,
      resamples,
      results: challengerResults,
    }),
    perPrompt,
    summary: {
      baselineWins,
      challengerWins,
      ties,
      insufficientData,
      totalPrompts: allIds.length,
    },
  })
}

export const selectPromotionDecision = ({
  comparison,
  minPassRateDelta = 0,
  minWinDelta = 1,
}: {
  comparison: ResearchRunComparison
  minPassRateDelta?: number
  minWinDelta?: number
}): ResearchPromotionDecision => {
  const parsedComparison = ResearchRunComparisonSchema.parse(comparison)
  const winDelta = parsedComparison.summary.challengerWins - parsedComparison.summary.baselineWins
  const comparablePromptCount = parsedComparison.summary.totalPrompts - parsedComparison.summary.insufficientData
  const passRateDelta = parsedComparison.challenger.avgPassRate - parsedComparison.baseline.avgPassRate
  const passAtKDelta = parsedComparison.challenger.avgPassAtK - parsedComparison.baseline.avgPassAtK

  if (comparablePromptCount <= 0) {
    return ResearchPromotionDecisionSchema.parse({
      decision: 'keep_baseline',
      winner: 'baseline',
      reason: 'Baseline retained (no comparable prompt evidence: all rows are insufficient_data).',
      winDelta,
      passRateDelta,
      passAtKDelta,
    })
  }

  const promoteByWins = winDelta >= minWinDelta
  const promoteByTieBreak = winDelta === 0 && passRateDelta > minPassRateDelta && passAtKDelta > 0
  const promoteByQuality = passRateDelta >= minPassRateDelta

  if ((promoteByWins || promoteByTieBreak) && promoteByQuality) {
    return ResearchPromotionDecisionSchema.parse({
      decision: 'promote_challenger',
      winner: 'challenger',
      reason: `Challenger met promotion gate (winDelta=${winDelta}, passRateDelta=${passRateDelta.toFixed(4)}, passAtKDelta=${passAtKDelta.toFixed(4)}).`,
      winDelta,
      passRateDelta,
      passAtKDelta,
    })
  }

  return ResearchPromotionDecisionSchema.parse({
    decision: 'keep_baseline',
    winner: 'baseline',
    reason: `Baseline retained (winDelta=${winDelta}, passRateDelta=${passRateDelta.toFixed(4)}, passAtKDelta=${passAtKDelta.toFixed(4)}).`,
    winDelta,
    passRateDelta,
    passAtKDelta,
  })
}
