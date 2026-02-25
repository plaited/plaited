/**
 * Pipeline compare command for trials data.
 *
 * @remarks
 * Compares multiple runs of TrialResult data, analyzing capability (passAtK),
 * reliability (passExpK), and flakiness metrics.
 *
 * Outputs a TrialsComparisonReport JSON (not JSONL) containing aggregate
 * statistics across all dimensions plus head-to-head comparisons.
 *
 * Built-in strategies:
 * - `weighted`: Configurable weights for capability, reliability, consistency (default)
 * - `statistical`: Bootstrap sampling for confidence intervals on passAtK
 *
 * @packageDocumentation
 */

import { logProgress, writeOutput } from '../core.ts'
import { bootstrap, formatCI, getBootstrapConfigFromEnv } from '../graders/bootstrap.ts'
import { grade as statisticalGrade } from '../graders/trials-compare-statistical.ts'
import { grade as weightedGrade } from '../graders/trials-compare-weighted.ts'
import type {
  PairwiseComparison,
  TrialResult,
  TrialsCapabilityMetrics,
  TrialsComparisonMeta,
  TrialsComparisonReport,
  TrialsFlakinessMetrics,
  TrialsPerformanceMetrics,
  TrialsPromptComparison,
  TrialsQualityMetrics,
  TrialsReliabilityMetrics,
} from '../schemas.ts'
import { TrialResultSchema } from '../schemas.ts'
import { computeLatencyStats, percentile } from './compare-utils.ts'
import type {
  ComparisonGraderResult,
  LabeledRun,
  TrialsComparisonGrader,
  TrialsComparisonGraderInput,
  TrialsComparisonRunData,
} from './pipeline.types.ts'

/** Comparison strategy type for trials */
export type TrialsCompareStrategy = 'weighted' | 'statistical' | 'custom'

/** Extended compare config for trials */
export type TrialsCompareConfig = {
  /** Labeled runs to compare */
  runs: LabeledRun[]
  /** Comparison strategy (default: weighted) */
  strategy?: TrialsCompareStrategy
  /** Path to custom grader (required if strategy is 'custom') */
  graderPath?: string
  /** Output file path */
  outputPath?: string
  /** Show progress to stderr */
  progress?: boolean
  /** Output format (default: json) */
  format?: 'json' | 'markdown'
}

/**
 * Stream trial results from a JSONL file.
 *
 * @param path - Path to the trials.jsonl file
 * @yields Parsed and validated trial results
 */
async function* streamTrialResults(path: string): AsyncGenerator<TrialResult, void, unknown> {
  const file = Bun.file(path)
  const text = await file.text()
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue

    try {
      yield TrialResultSchema.parse(JSON.parse(line))
    } catch (error) {
      throw new Error(`Invalid trial result at line ${i + 1}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

/**
 * Build an indexed map of trial results by ID.
 *
 * @param path - Path to the trials.jsonl file
 * @returns Map of result ID to TrialResult
 */
export const buildTrialsIndex = async (path: string): Promise<Map<string, TrialResult>> => {
  const index = new Map<string, TrialResult>()

  for await (const result of streamTrialResults(path)) {
    index.set(result.id, result)
  }

  return index
}

/**
 * Load trials comparison grader from file.
 *
 * @param path - Path to grader module
 * @returns Loaded trials comparison grader function
 * @throws Error if module cannot be loaded or doesn't export a grader function
 */
const loadTrialsComparisonGrader = async (path: string): Promise<TrialsComparisonGrader> => {
  let module: Record<string, unknown>
  try {
    module = (await import(path)) as Record<string, unknown>
  } catch (error) {
    throw new Error(`Failed to load grader from '${path}': ${error instanceof Error ? error.message : error}`)
  }

  if (typeof module.grade === 'function') {
    return module.grade as TrialsComparisonGrader
  }
  if (typeof module.default === 'function') {
    return module.default as TrialsComparisonGrader
  }
  if (typeof module.compare === 'function') {
    return module.compare as TrialsComparisonGrader
  }

  throw new Error(`Trials comparison grader must export 'grade', 'compare', or 'default' function`)
}

/**
 * Get grader function based on strategy.
 *
 * @param strategy - Comparison strategy
 * @param graderPath - Path to custom grader (for 'custom' strategy)
 * @returns Trials comparison grader function
 */
const getTrialsGrader = async (
  strategy: TrialsCompareStrategy,
  graderPath?: string,
): Promise<TrialsComparisonGrader> => {
  switch (strategy) {
    case 'weighted':
      return weightedGrade
    case 'statistical':
      return statisticalGrade
    case 'custom':
      if (!graderPath) {
        throw new Error('Custom strategy requires --grader path')
      }
      return loadTrialsComparisonGrader(graderPath)
  }
}

/**
 * Compute capability metrics from trial results.
 *
 * @param results - Array of trial results
 * @returns Capability metrics (passAtK statistics)
 */
const computeCapabilityMetrics = (results: TrialResult[]): TrialsCapabilityMetrics => {
  const passAtKValues = results.map((r) => r.passAtK ?? 0)

  if (passAtKValues.length === 0) {
    return { avgPassAtK: 0, medianPassAtK: 0, p25PassAtK: 0, p75PassAtK: 0 }
  }

  const sorted = [...passAtKValues].sort((a, b) => a - b)
  const sum = passAtKValues.reduce((a, b) => a + b, 0)

  return {
    avgPassAtK: sum / passAtKValues.length,
    medianPassAtK: percentile(sorted, 0.5),
    p25PassAtK: percentile(sorted, 0.25),
    p75PassAtK: percentile(sorted, 0.75),
  }
}

/**
 * Compute reliability metrics from trial results.
 *
 * @param results - Array of trial results
 * @returns Reliability metrics (passExpK statistics)
 */
const computeReliabilityMetrics = (results: TrialResult[]): TrialsReliabilityMetrics => {
  const passExpKValues = results.map((r) => r.passExpK ?? 0)

  if (passExpKValues.length === 0) {
    return { type: 'trial', avgPassExpK: 0, medianPassExpK: 0, p25PassExpK: 0, p75PassExpK: 0 }
  }

  const sorted = [...passExpKValues].sort((a, b) => a - b)
  const sum = passExpKValues.reduce((a, b) => a + b, 0)

  return {
    type: 'trial',
    avgPassExpK: sum / passExpKValues.length,
    medianPassExpK: percentile(sorted, 0.5),
    p25PassExpK: percentile(sorted, 0.25),
    p75PassExpK: percentile(sorted, 0.75),
  }
}

/**
 * Compute flakiness metrics from trial results.
 *
 * @param results - Array of trial results
 * @param maxTopFlaky - Maximum number of top flaky prompts to include
 * @returns Flakiness metrics
 */
const computeFlakinessMetrics = (results: TrialResult[], maxTopFlaky: number = 10): TrialsFlakinessMetrics => {
  const flakinessData = results.map((r) => ({
    id: r.id,
    flakiness: Math.max(0, (r.passAtK ?? 0) - (r.passExpK ?? 0)),
  }))

  if (flakinessData.length === 0) {
    return { avgFlakiness: 0, medianFlakiness: 0, flakyPromptCount: 0, topFlakyPrompts: [] }
  }

  const flakinessValues = flakinessData.map((d) => d.flakiness)
  const sorted = [...flakinessValues].sort((a, b) => a - b)
  const sum = flakinessValues.reduce((a, b) => a + b, 0)

  // Sort by flakiness descending to get top flaky prompts
  const topFlaky = [...flakinessData]
    .filter((d) => d.flakiness > 0)
    .sort((a, b) => b.flakiness - a.flakiness)
    .slice(0, maxTopFlaky)

  return {
    avgFlakiness: sum / flakinessValues.length,
    medianFlakiness: percentile(sorted, 0.5),
    flakyPromptCount: flakinessData.filter((d) => d.flakiness > 0).length,
    topFlakyPrompts: topFlaky,
  }
}

/** Result from quality metrics computation, including raw scores for CI reuse */
type QualityComputeResult = {
  metrics: TrialsQualityMetrics
  rawScores: number[]
}

/**
 * Compute quality metrics from trial results.
 *
 * @remarks
 * Flattens all trial scores across all prompts into a single distribution.
 * Returns undefined if no scores are present (no grader was used).
 * Returns raw scores alongside metrics to avoid re-traversal for CI computation.
 *
 * @param results - Array of trial results
 * @returns Quality metrics with raw scores, or undefined if no scores
 */
const computeTrialsQualityMetrics = (results: TrialResult[]): QualityComputeResult | undefined => {
  const rawScores = results.flatMap((r) => r.trials.filter((t) => t.score !== undefined).map((t) => t.score as number))

  if (rawScores.length === 0) return undefined

  const sorted = [...rawScores].sort((a, b) => a - b)
  const sum = rawScores.reduce((a, b) => a + b, 0)

  return {
    metrics: {
      type: 'trial',
      avgScore: sum / rawScores.length,
      medianScore: percentile(sorted, 0.5),
      p25Score: percentile(sorted, 0.25),
      p75Score: percentile(sorted, 0.75),
    },
    rawScores,
  }
}

/** Result from performance metrics computation, including raw durations for CI reuse */
type PerformanceComputeResult = {
  metrics: TrialsPerformanceMetrics
  rawDurations: number[]
}

/**
 * Compute performance metrics from trial results.
 *
 * @remarks
 * Flattens all trial durations across all prompts into latency statistics.
 * Always returns a value since TrialEntry.duration is required.
 * Returns raw durations alongside metrics to avoid re-traversal for CI computation.
 *
 * @param results - Array of trial results
 * @returns Performance metrics with raw durations
 */
const computeTrialsPerformanceMetrics = (results: TrialResult[]): PerformanceComputeResult => {
  const rawDurations = results.flatMap((r) => r.trials.map((t) => t.duration))

  return {
    metrics: {
      latency: computeLatencyStats(rawDurations),
      totalDuration: rawDurations.reduce((a, b) => a + b, 0),
    },
    rawDurations,
  }
}

/**
 * Execute trials comparison and generate aggregate report.
 *
 * @param config - Trials compare configuration
 * @returns Trials comparison report
 */
export const runTrialsCompare = async (config: TrialsCompareConfig): Promise<TrialsComparisonReport> => {
  const { runs, strategy = 'weighted', graderPath, outputPath, progress = false, format = 'json' } = config

  if (runs.length < 2) {
    throw new Error('At least 2 runs required for comparison')
  }

  // Get grader based on strategy
  const grader = await getTrialsGrader(strategy, graderPath)

  const strategyLabel = strategy === 'custom' ? `custom: ${graderPath}` : strategy
  logProgress(`Comparing ${runs.length} trials runs with strategy: ${strategyLabel}`, progress)
  for (const run of runs) {
    logProgress(`  - ${run.label}: ${run.path}`, progress)
  }

  // Load all runs using indexed streaming
  const runResults: Record<string, Map<string, TrialResult>> = {}
  for (const run of runs) {
    logProgress(`Loading ${run.label}...`, progress)
    runResults[run.label] = await buildTrialsIndex(run.path)
  }

  // Build set of all prompt IDs across runs
  const promptIds = new Set<string>()
  for (const resultsMap of Object.values(runResults)) {
    for (const id of resultsMap.keys()) {
      promptIds.add(id)
    }
  }

  logProgress(`Comparing ${promptIds.size} prompts...`, progress)

  // Per-prompt comparison results
  const promptComparisons: TrialsPromptComparison[] = []
  const perPromptGraderResults: { id: string; result: ComparisonGraderResult }[] = []

  // Track k value (should be consistent across all results)
  let trialsPerPrompt = 0

  for (const promptId of promptIds) {
    logProgress(`  ${promptId}`, progress)

    // Build comparison input
    const runsData: TrialsComparisonGraderInput['runs'] = {}
    let input: string | string[] = ''
    let hint: string | undefined

    for (const [label, resultsMap] of Object.entries(runResults)) {
      const result = resultsMap.get(promptId)
      if (result) {
        const runData: TrialsComparisonRunData = {
          passRate: result.passRate,
          passAtK: result.passAtK,
          passExpK: result.passExpK,
          k: result.k,
          trials: result.trials,
        }
        runsData[label] = runData

        // Track k value
        if (trialsPerPrompt === 0) {
          trialsPerPrompt = result.k
        }

        // Use first found input/hint as the reference
        if (!input) {
          input = result.input
          hint = result.hint
        }
      }
    }

    // Skip if not present in at least 2 runs
    if (Object.keys(runsData).length < 2) {
      logProgress(`    Skipped (only in ${Object.keys(runsData).length} run)`, progress)
      continue
    }

    // Apply comparison grader
    const graderInput: TrialsComparisonGraderInput = {
      id: promptId,
      input,
      hint,
      runs: runsData,
    }

    const graderResult = await grader(graderInput)
    perPromptGraderResults.push({ id: promptId, result: graderResult })

    // Build prompt comparison for head-to-head
    const passAtK: Record<string, number> = {}
    const passExpK: Record<string, number> = {}
    const flakiness: Record<string, number> = {}

    for (const [label, data] of Object.entries(runsData)) {
      passAtK[label] = data.passAtK ?? 0
      passExpK[label] = data.passExpK ?? 0
      flakiness[label] = Math.max(0, (data.passAtK ?? 0) - (data.passExpK ?? 0))
    }

    // Determine winners
    const labels = Object.keys(runsData)
    let capabilityWinner: string | null = null
    let reliabilityWinner: string | null = null

    // Capability winner: highest passAtK
    const sortedByCapability = [...labels].sort((a, b) => (passAtK[b] ?? 0) - (passAtK[a] ?? 0))
    if (sortedByCapability.length >= 2) {
      const first = sortedByCapability[0]
      const second = sortedByCapability[1]
      if (first && second && (passAtK[first] ?? 0) > (passAtK[second] ?? 0)) {
        capabilityWinner = first
      }
    }

    // Reliability winner: highest passExpK
    const sortedByReliability = [...labels].sort((a, b) => (passExpK[b] ?? 0) - (passExpK[a] ?? 0))
    if (sortedByReliability.length >= 2) {
      const first = sortedByReliability[0]
      const second = sortedByReliability[1]
      if (first && second && (passExpK[first] ?? 0) > (passExpK[second] ?? 0)) {
        reliabilityWinner = first
      }
    }

    promptComparisons.push({
      id: promptId,
      capabilityWinner,
      reliabilityWinner,
      passAtK,
      passExpK,
      flakiness,
    })

    // Log winner
    const winner = graderResult.rankings.find((r) => r.rank === 1)
    if (winner) {
      logProgress(`    Overall winner: ${winner.run} (${winner.score.toFixed(3)})`, progress)
    }
  }

  // Compute aggregate metrics per run
  const runLabels = runs.map((r) => r.label)

  const capability: Record<string, TrialsCapabilityMetrics> = {}
  const reliability: Record<string, TrialsReliabilityMetrics> = {}
  const flakiness: Record<string, TrialsFlakinessMetrics> = {}
  const quality: Record<string, TrialsQualityMetrics> = {}
  const performance: Record<string, TrialsPerformanceMetrics> = {}
  const rawScoresByRun: Record<string, number[]> = {}
  const rawDurationsByRun: Record<string, number[]> = {}

  let hasQuality = false

  for (const label of runLabels) {
    const resultsMap = runResults[label] ?? new Map()
    const results = [...resultsMap.values()]

    capability[label] = computeCapabilityMetrics(results)
    reliability[label] = computeReliabilityMetrics(results)
    flakiness[label] = computeFlakinessMetrics(results)

    const perfResult = computeTrialsPerformanceMetrics(results)
    performance[label] = perfResult.metrics
    rawDurationsByRun[label] = perfResult.rawDurations

    const qualityResult = computeTrialsQualityMetrics(results)
    if (qualityResult) {
      quality[label] = qualityResult.metrics
      rawScoresByRun[label] = qualityResult.rawScores
      hasQuality = true
    }
  }

  // Compute confidence intervals when using statistical strategy
  if (strategy === 'statistical') {
    const bootstrapConfig = getBootstrapConfigFromEnv()

    for (const label of runLabels) {
      const resultsMap = runResults[label] ?? new Map()
      const resultsArr = [...resultsMap.values()]
      const passAtKValues = resultsArr.map((r) => r.passAtK ?? 0)
      const passExpKValues = resultsArr.map((r) => r.passExpK ?? 0)

      // Capability CIs
      const capabilityMetrics = capability[label]
      if (capabilityMetrics) {
        capabilityMetrics.confidenceIntervals = {
          avgPassAtK: bootstrap(passAtKValues, bootstrapConfig).ci,
        }
      }

      // Reliability CIs
      const reliabilityMetrics = reliability[label]
      if (reliabilityMetrics) {
        reliabilityMetrics.confidenceIntervals = {
          avgPassExpK: bootstrap(passExpKValues, bootstrapConfig).ci,
        }
      }

      // Quality CIs (only when scores present)
      const qualityMetrics = quality[label]
      const scores = rawScoresByRun[label]
      if (qualityMetrics && scores && scores.length > 0) {
        qualityMetrics.confidenceIntervals = {
          avgScore: bootstrap(scores, bootstrapConfig).ci,
        }
      }

      // Performance CIs
      const performanceMetrics = performance[label]
      const durations = rawDurationsByRun[label]
      if (performanceMetrics && durations && durations.length > 0) {
        performanceMetrics.confidenceIntervals = {
          latencyMean: bootstrap(durations, bootstrapConfig).ci,
        }
      }
    }
  }

  // Compute pairwise comparisons
  const capabilityPairwise: PairwiseComparison[] = []
  const reliabilityPairwise: PairwiseComparison[] = []
  const overallPairwise: PairwiseComparison[] = []

  for (let i = 0; i < runLabels.length; i++) {
    for (let j = i + 1; j < runLabels.length; j++) {
      const runA = runLabels[i]
      const runB = runLabels[j]

      if (!runA || !runB) continue

      // Capability pairwise
      let capAWins = 0
      let capBWins = 0
      let capTies = 0

      // Reliability pairwise
      let relAWins = 0
      let relBWins = 0
      let relTies = 0

      // Overall pairwise (from grader results)
      let overallAWins = 0
      let overallBWins = 0
      let overallTies = 0

      for (const pc of promptComparisons) {
        // Capability
        if (pc.capabilityWinner === runA) capAWins++
        else if (pc.capabilityWinner === runB) capBWins++
        else capTies++

        // Reliability
        if (pc.reliabilityWinner === runA) relAWins++
        else if (pc.reliabilityWinner === runB) relBWins++
        else relTies++
      }

      // Overall from grader results
      for (const { result } of perPromptGraderResults) {
        const winner = result.rankings.find((r) => r.rank === 1)
        if (winner?.run === runA) overallAWins++
        else if (winner?.run === runB) overallBWins++
        else overallTies++
      }

      capabilityPairwise.push({ runA, runB, aWins: capAWins, bWins: capBWins, ties: capTies })
      reliabilityPairwise.push({ runA, runB, aWins: relAWins, bWins: relBWins, ties: relTies })
      overallPairwise.push({ runA, runB, aWins: overallAWins, bWins: overallBWins, ties: overallTies })
    }
  }

  // Build meta
  const meta: TrialsComparisonMeta = {
    generatedAt: new Date().toISOString(),
    runs: runLabels,
    promptCount: promptIds.size,
    trialsPerPrompt,
    inputFormat: 'trials',
  }

  // Assemble report
  const report: TrialsComparisonReport = {
    meta,
    capability,
    reliability,
    flakiness,
    quality: hasQuality ? quality : undefined,
    performance,
    headToHead: {
      capability: capabilityPairwise,
      reliability: reliabilityPairwise,
      overall: overallPairwise,
    },
    perPrompt: promptComparisons,
  }

  // Output
  if (format === 'markdown') {
    const markdown = formatTrialsReportAsMarkdown(report)
    await writeOutput(markdown, outputPath, false)
  } else {
    await writeOutput(JSON.stringify(report, null, 2), outputPath, false)
  }

  // Summary statistics
  logProgress('', progress)
  logProgress('=== Summary ===', progress)

  for (const [label, cap] of Object.entries(capability)) {
    const rel = reliability[label]
    const flak = flakiness[label]
    const perf = performance[label]
    const qual = quality[label]
    const qualStr = qual ? ` avgScore=${qual.avgScore.toFixed(3)}` : ''
    const perfStr = perf ? ` latencyP50=${perf.latency.p50.toFixed(0)}ms` : ''
    logProgress(
      `  ${label}: passAtK=${cap?.avgPassAtK.toFixed(3)} passExpK=${rel?.avgPassExpK.toFixed(3)} flakiness=${flak?.avgFlakiness.toFixed(3)}${qualStr}${perfStr}`,
      progress,
    )
  }

  logProgress('', progress)
  logProgress('Overall wins:', progress)
  for (const pw of overallPairwise) {
    logProgress(`  ${pw.runA} vs ${pw.runB}: ${pw.aWins}-${pw.bWins}-${pw.ties}`, progress)
  }

  logProgress('Done!', progress)

  return report
}

/**
 * Format trials comparison report as markdown.
 *
 * @param report - Trials comparison report
 * @returns Markdown string
 */
const formatTrialsReportAsMarkdown = (report: TrialsComparisonReport): string => {
  const lines: string[] = []

  lines.push('# Trials Comparison Report')
  lines.push('')
  lines.push(`Generated: ${report.meta.generatedAt}`)
  lines.push(`Runs: ${report.meta.runs.join(', ')}`)
  lines.push(`Prompts: ${report.meta.promptCount} | Trials per prompt: ${report.meta.trialsPerPrompt}`)
  lines.push('')

  // Check if any run has confidence intervals (statistical strategy was used)
  const hasCIs = Object.values(report.capability).some((c) => c.confidenceIntervals)

  // Capability table
  lines.push('## Capability (passAtK)')
  lines.push('')
  if (hasCIs) {
    lines.push('| Run | Avg | 95% CI | Median | P25 | P75 |')
    lines.push('|-----|-----|--------|--------|-----|-----|')
    for (const [label, c] of Object.entries(report.capability)) {
      const avgCI = formatCI(c.confidenceIntervals?.avgPassAtK)
      lines.push(
        `| ${label} | ${c.avgPassAtK.toFixed(3)} | ${avgCI} | ${c.medianPassAtK.toFixed(3)} | ${c.p25PassAtK.toFixed(3)} | ${c.p75PassAtK.toFixed(3)} |`,
      )
    }
  } else {
    lines.push('| Run | Avg | Median | P25 | P75 |')
    lines.push('|-----|-----|--------|-----|-----|')
    for (const [label, c] of Object.entries(report.capability)) {
      lines.push(
        `| ${label} | ${c.avgPassAtK.toFixed(3)} | ${c.medianPassAtK.toFixed(3)} | ${c.p25PassAtK.toFixed(3)} | ${c.p75PassAtK.toFixed(3)} |`,
      )
    }
  }
  lines.push('')

  // Reliability table
  lines.push('## Reliability (passExpK)')
  lines.push('')
  if (hasCIs) {
    lines.push('| Run | Avg | 95% CI | Median | P25 | P75 |')
    lines.push('|-----|-----|--------|--------|-----|-----|')
    for (const [label, r] of Object.entries(report.reliability)) {
      const avgCI = formatCI(r.confidenceIntervals?.avgPassExpK)
      lines.push(
        `| ${label} | ${r.avgPassExpK.toFixed(3)} | ${avgCI} | ${r.medianPassExpK.toFixed(3)} | ${r.p25PassExpK.toFixed(3)} | ${r.p75PassExpK.toFixed(3)} |`,
      )
    }
  } else {
    lines.push('| Run | Avg | Median | P25 | P75 |')
    lines.push('|-----|-----|--------|-----|-----|')
    for (const [label, r] of Object.entries(report.reliability)) {
      lines.push(
        `| ${label} | ${r.avgPassExpK.toFixed(3)} | ${r.medianPassExpK.toFixed(3)} | ${r.p25PassExpK.toFixed(3)} | ${r.p75PassExpK.toFixed(3)} |`,
      )
    }
  }
  lines.push('')

  // Flakiness table
  lines.push('## Flakiness')
  lines.push('')
  lines.push('| Run | Avg | Median | Flaky Prompts |')
  lines.push('|-----|-----|--------|---------------|')
  for (const [label, f] of Object.entries(report.flakiness)) {
    lines.push(`| ${label} | ${f.avgFlakiness.toFixed(3)} | ${f.medianFlakiness.toFixed(3)} | ${f.flakyPromptCount} |`)
  }
  lines.push('')

  // Quality table (only when scores present)
  if (report.quality && Object.keys(report.quality).length > 0) {
    const hasQualityCIs = Object.values(report.quality).some((q) => q.confidenceIntervals)

    lines.push('## Quality (Scores)')
    lines.push('')
    if (hasQualityCIs) {
      lines.push('| Run | Avg Score | 95% CI | Median | P25 | P75 |')
      lines.push('|-----|-----------|--------|--------|-----|-----|')
      for (const [label, q] of Object.entries(report.quality)) {
        const avgCI = formatCI(q.confidenceIntervals?.avgScore)
        lines.push(
          `| ${label} | ${q.avgScore.toFixed(3)} | ${avgCI} | ${q.medianScore.toFixed(3)} | ${q.p25Score.toFixed(3)} | ${q.p75Score.toFixed(3)} |`,
        )
      }
    } else {
      lines.push('| Run | Avg Score | Median | P25 | P75 |')
      lines.push('|-----|-----------|--------|-----|-----|')
      for (const [label, q] of Object.entries(report.quality)) {
        lines.push(
          `| ${label} | ${q.avgScore.toFixed(3)} | ${q.medianScore.toFixed(3)} | ${q.p25Score.toFixed(3)} | ${q.p75Score.toFixed(3)} |`,
        )
      }
    }
    lines.push('')
  }

  // Performance table (always present)
  const hasPerfCIs = Object.values(report.performance).some((p) => p.confidenceIntervals)

  lines.push('## Performance (Latency)')
  lines.push('')
  if (hasPerfCIs) {
    lines.push('| Run | P50 (ms) | P90 (ms) | P99 (ms) | Mean (ms) | 95% CI | Total (ms) |')
    lines.push('|-----|----------|----------|----------|-----------|--------|------------|')
    for (const [label, p] of Object.entries(report.performance)) {
      const latencyCI = formatCI(p.confidenceIntervals?.latencyMean, 0)
      lines.push(
        `| ${label} | ${p.latency.p50.toFixed(0)} | ${p.latency.p90.toFixed(0)} | ${p.latency.p99.toFixed(0)} | ${p.latency.mean.toFixed(0)} | ${latencyCI} | ${p.totalDuration.toFixed(0)} |`,
      )
    }
  } else {
    lines.push('| Run | P50 (ms) | P90 (ms) | P99 (ms) | Mean (ms) | Total (ms) |')
    lines.push('|-----|----------|----------|----------|-----------|------------|')
    for (const [label, p] of Object.entries(report.performance)) {
      lines.push(
        `| ${label} | ${p.latency.p50.toFixed(0)} | ${p.latency.p90.toFixed(0)} | ${p.latency.p99.toFixed(0)} | ${p.latency.mean.toFixed(0)} | ${p.totalDuration.toFixed(0)} |`,
      )
    }
  }
  lines.push('')

  // Head-to-head
  lines.push('## Head-to-Head')
  lines.push('')
  lines.push('### By Capability')
  lines.push('| Matchup | A Wins | B Wins | Ties |')
  lines.push('|---------|--------|--------|------|')
  for (const p of report.headToHead.capability) {
    lines.push(`| ${p.runA} vs ${p.runB} | ${p.aWins} | ${p.bWins} | ${p.ties} |`)
  }
  lines.push('')

  lines.push('### By Reliability')
  lines.push('| Matchup | A Wins | B Wins | Ties |')
  lines.push('|---------|--------|--------|------|')
  for (const p of report.headToHead.reliability) {
    lines.push(`| ${p.runA} vs ${p.runB} | ${p.aWins} | ${p.bWins} | ${p.ties} |`)
  }
  lines.push('')

  lines.push('### Overall (Weighted)')
  lines.push('| Matchup | A Wins | B Wins | Ties |')
  lines.push('|---------|--------|--------|------|')
  for (const p of report.headToHead.overall) {
    lines.push(`| ${p.runA} vs ${p.runB} | ${p.aWins} | ${p.bWins} | ${p.ties} |`)
  }
  lines.push('')

  return lines.join('\n')
}
