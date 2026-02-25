/**
 * Pipeline compare command - compare multiple runs of the same prompts.
 *
 * @remarks
 * Compares results from different configurations (agents, MCP servers, models)
 * using either built-in strategies or a user-provided comparison grader.
 *
 * Outputs a holistic ComparisonReport JSON (not JSONL) containing aggregate
 * statistics across quality, performance, reliability, and head-to-head metrics.
 *
 * Terminology: "runs" (not "agents") because comparisons can be:
 * - Same agent, different MCP servers
 * - Same agent, different skills enabled
 * - Same agent, different system prompts
 * - Same agent, different model versions
 * - Different agents entirely
 *
 * Built-in strategies:
 * - `weighted`: Configurable weights for quality, latency, reliability (default)
 * - `statistical`: Bootstrap sampling for confidence intervals
 *
 * @packageDocumentation
 */

import { basename, extname } from 'node:path'
import { parseArgs } from 'node:util'
import { buildResultsIndex, logProgress, writeOutput } from '../core.ts'
import { bootstrap, formatCI, getBootstrapConfigFromEnv } from '../graders/bootstrap.ts'
import { grade as statisticalGrade } from '../graders/compare-statistical.ts'
import { grade as weightedGrade } from '../graders/compare-weighted.ts'
import type {
  CaptureResult,
  ComparisonMeta,
  ComparisonReport,
  HeadToHead,
  PairwiseComparison,
  PerformanceMetrics,
  PromptComparison,
  QualityMetrics,
  ReliabilityMetrics,
  TrajectoryInfo,
  TrajectoryRichness,
} from '../schemas.ts'
import { type CompareInputFormat, detectAndValidateFormat } from './compare-format-detection.ts'
import { runTrialsCompare } from './compare-trials.ts'
import { computeLatencyStats, computeScoreDistribution } from './compare-utils.ts'
import type {
  CompareConfig,
  ComparisonGrader,
  ComparisonGraderInput,
  ComparisonResult,
  LabeledRun,
} from './pipeline.types.ts'

/** Comparison strategy type */
export type CompareStrategy = 'weighted' | 'statistical' | 'custom'

/** Extended compare config with strategy support */
export type ExtendedCompareConfig = Omit<CompareConfig, 'graderPath'> & {
  /** Comparison strategy (default: weighted) */
  strategy?: CompareStrategy
  /** Path to custom grader (required if strategy is 'custom') */
  graderPath?: string
  /** Output format (default: json) */
  format?: 'json' | 'markdown'
}

/**
 * Load comparison grader from file.
 *
 * @remarks
 * Similar to loadGrader but expects ComparisonGrader interface.
 *
 * @param path - Path to grader module
 * @returns Loaded comparison grader function
 */
const loadComparisonGrader = async (path: string): Promise<ComparisonGrader> => {
  const module = await import(path)

  if (typeof module.grade === 'function') {
    return module.grade as ComparisonGrader
  }
  if (typeof module.default === 'function') {
    return module.default as ComparisonGrader
  }
  if (typeof module.compare === 'function') {
    return module.compare as ComparisonGrader
  }

  throw new Error(`Comparison grader must export 'grade', 'compare', or 'default' function`)
}

/**
 * Derive label from file path.
 *
 * @param path - File path
 * @returns Label derived from filename without extension
 */
const labelFromPath = (path: string): string => {
  const base = basename(path)
  const ext = extname(base)
  return base.slice(0, -ext.length)
}

/**
 * Parse labeled run argument.
 *
 * @remarks
 * Supports formats:
 * - "path.jsonl" - label derived from filename
 * - "label:path.jsonl" - explicit label
 *
 * @param arg - Run argument string
 * @returns Labeled run object
 */
const parseLabeledRun = (arg: string): LabeledRun => {
  const colonIndex = arg.indexOf(':')

  // Check if this looks like a label:path format (not a Windows drive letter)
  if (colonIndex > 0 && colonIndex !== 1) {
    return {
      label: arg.slice(0, colonIndex),
      path: arg.slice(colonIndex + 1),
    }
  }

  return {
    label: labelFromPath(arg),
    path: arg,
  }
}

/**
 * Validate that all run files exist.
 *
 * @param runs - Labeled runs to validate
 * @throws Error if any file doesn't exist
 */
const validateRunFiles = async (runs: LabeledRun[]): Promise<void> => {
  const missing: string[] = []

  for (const run of runs) {
    const exists = await Bun.file(run.path).exists()
    if (!exists) {
      missing.push(`${run.label}: ${run.path}`)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Result file(s) not found:\n  ${missing.join('\n  ')}`)
  }
}

/**
 * Infer output format from file extension.
 *
 * @param outputPath - Output file path
 * @param explicitFormat - Explicitly provided format (takes precedence)
 * @returns Inferred format
 */
const inferFormat = (outputPath: string | undefined, explicitFormat: string | undefined): 'json' | 'markdown' => {
  // Explicit format takes precedence
  if (explicitFormat === 'json' || explicitFormat === 'markdown') {
    return explicitFormat
  }

  // Infer from file extension
  if (outputPath) {
    const ext = extname(outputPath).toLowerCase()
    if (ext === '.md' || ext === '.markdown') {
      return 'markdown'
    }
  }

  return 'json'
}

/**
 * Get grader function based on strategy.
 *
 * @param strategy - Comparison strategy
 * @param graderPath - Path to custom grader (for 'custom' strategy)
 * @returns Comparison grader function
 */
const getGrader = async (strategy: CompareStrategy, graderPath?: string): Promise<ComparisonGrader> => {
  switch (strategy) {
    case 'weighted':
      return weightedGrade
    case 'statistical':
      return statisticalGrade
    case 'custom':
      if (!graderPath) {
        throw new Error('Custom strategy requires --grader path')
      }
      return loadComparisonGrader(graderPath)
  }
}

/**
 * Detect trajectory richness from capture results.
 *
 * @param results - Array of capture results
 * @returns Most common trajectory richness level
 */
const detectTrajectoryRichness = (results: CaptureResult[]): TrajectoryRichness => {
  // Check metadata first
  for (const r of results) {
    const richness = r.metadata?.trajectoryRichness
    if (richness === 'full' || richness === 'minimal' || richness === 'messages-only') {
      return richness as TrajectoryRichness
    }
  }

  // Infer from trajectory content
  for (const r of results) {
    const hasThought = r.trajectory.some((s) => s.type === 'thought')
    const hasToolCall = r.trajectory.some((s) => s.type === 'tool_call')
    if (hasThought || hasToolCall) return 'full'
  }

  // Check if we have any trajectory at all
  const hasTrajectory = results.some((r) => r.trajectory.length > 0)
  return hasTrajectory ? 'messages-only' : 'minimal'
}

/**
 * Execute pipeline compare and generate aggregate report.
 *
 * @param config - Extended compare configuration
 * @returns Comparison report
 */
export const runCompare = async (config: ExtendedCompareConfig): Promise<ComparisonReport> => {
  const { runs, strategy = 'weighted', graderPath, outputPath, progress = false, format = 'json' } = config

  if (runs.length < 2) {
    throw new Error('At least 2 runs required for comparison')
  }

  // Get grader based on strategy
  const grader = await getGrader(strategy, graderPath)

  const strategyLabel = strategy === 'custom' ? `custom: ${graderPath}` : strategy
  logProgress(`Comparing ${runs.length} runs with strategy: ${strategyLabel}`, progress)
  for (const run of runs) {
    logProgress(`  - ${run.label}: ${run.path}`, progress)
  }

  // Load all runs using indexed streaming (memory-efficient for large files)
  // Uses Map<id, result> instead of arrays for O(1) lookups
  const runResults: Record<string, Map<string, CaptureResult>> = {}
  for (const run of runs) {
    logProgress(`Loading ${run.label}...`, progress)
    runResults[run.label] = await buildResultsIndex(run.path)
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
  const perPromptResults: ComparisonResult[] = []
  const promptComparisons: PromptComparison[] = []

  for (const promptId of promptIds) {
    logProgress(`  ${promptId}`, progress)

    // Build comparison input
    const runsData: ComparisonGraderInput['runs'] = {}
    let input: string | string[] = ''
    let hint: string | undefined
    let metadata: Record<string, unknown> | undefined

    for (const [label, resultsMap] of Object.entries(runResults)) {
      const result = resultsMap.get(promptId)
      if (result) {
        runsData[label] = {
          output: result.output,
          trajectory: result.trajectory,
          // Include additional fields for graders that need them
          ...(result.score && { score: result.score }),
          ...(result.timing && { duration: result.timing.total }),
          ...(result.toolErrors !== undefined && { toolErrors: result.toolErrors }),
        }
        // Use first found input/hint/metadata as the reference
        if (!input) {
          input = result.input
          hint = result.hint
          metadata = result.metadata
        }
      }
    }

    // Skip if not present in at least 2 runs
    if (Object.keys(runsData).length < 2) {
      logProgress(`    Skipped (only in ${Object.keys(runsData).length} run)`, progress)
      continue
    }

    // Apply comparison grader
    const graderInput: ComparisonGraderInput = {
      id: promptId,
      input,
      hint,
      metadata,
      runs: runsData,
    }

    const graderResult = await grader(graderInput)

    const comparisonResult: ComparisonResult = {
      id: promptId,
      input,
      hint,
      rankings: graderResult.rankings,
      reasoning: graderResult.reasoning,
    }

    perPromptResults.push(comparisonResult)

    // Build prompt comparison for head-to-head
    const winner = graderResult.rankings.find((r) => r.rank === 1)
    const scores: Record<string, number> = {}
    const latencies: Record<string, number> = {}
    const hadErrors: Record<string, boolean> = {}

    for (const ranking of graderResult.rankings) {
      scores[ranking.run] = ranking.score
    }

    for (const [label, data] of Object.entries(runsData)) {
      latencies[label] = data.duration ?? 0
      hadErrors[label] = data.toolErrors ?? false
    }

    promptComparisons.push({
      id: promptId,
      winner: winner?.run ?? null,
      scores,
      latencies,
      hadErrors,
    })

    // Log winner
    if (winner) {
      logProgress(`    Winner: ${winner.run} (${winner.score.toFixed(2)})`, progress)
    }
  }

  // Compute aggregate metrics
  const runLabels = runs.map((r) => r.label)

  // Quality metrics (iterate over Map values)
  const quality: Record<string, QualityMetrics> = {}
  for (const label of runLabels) {
    const resultsMap = runResults[label] ?? new Map()
    const results = [...resultsMap.values()]
    const scores = results.map((r) => r.score?.score ?? 0)
    const passes = results.filter((r) => r.score?.pass === true).length
    const fails = results.length - passes

    quality[label] = {
      type: 'run',
      avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      passRate: results.length > 0 ? passes / results.length : 0,
      passCount: passes,
      failCount: fails,
      scoreDistribution: computeScoreDistribution(scores),
    }
  }

  // Performance metrics
  const performance: Record<string, PerformanceMetrics> = {}
  for (const label of runLabels) {
    const resultsMap = runResults[label] ?? new Map()
    const results = [...resultsMap.values()]
    const durations = results.map((r) => r.timing?.total ?? 0)
    const firstResponses = results.map((r) => r.timing?.firstResponse).filter((v): v is number => v !== undefined)

    performance[label] = {
      latency: computeLatencyStats(durations),
      firstResponse: firstResponses.length > 0 ? computeLatencyStats(firstResponses) : undefined,
      totalDuration: durations.reduce((a, b) => a + b, 0),
    }
  }

  // Reliability metrics
  const reliability: Record<string, ReliabilityMetrics> = {}
  for (const label of runLabels) {
    const resultsMap = runResults[label] ?? new Map()
    const results = [...resultsMap.values()]
    const toolErrorCount = results.filter((r) => r.toolErrors === true).length
    const timeoutCount = results.filter((r) =>
      r.errors?.some((e: string) => e.toLowerCase().includes('timeout')),
    ).length
    const completedCount = results.filter((r) => r.output && !r.errors?.length).length

    reliability[label] = {
      type: 'run',
      toolErrors: toolErrorCount,
      toolErrorRate: results.length > 0 ? toolErrorCount / results.length : 0,
      timeouts: timeoutCount,
      timeoutRate: results.length > 0 ? timeoutCount / results.length : 0,
      completionRate: results.length > 0 ? completedCount / results.length : 1,
    }
  }

  // Compute confidence intervals when using statistical strategy
  if (strategy === 'statistical') {
    const bootstrapConfig = getBootstrapConfigFromEnv()

    for (const label of runLabels) {
      const resultsMap = runResults[label] ?? new Map()
      const results = [...resultsMap.values()]
      const scores = results.map((r) => r.score?.score ?? 0)
      const passes = results.map((r) => (r.score?.pass === true ? 1 : 0))
      const latencies = results.map((r) => r.timing?.total ?? 0)

      // Quality CIs
      const qualityMetrics = quality[label]
      if (qualityMetrics) {
        qualityMetrics.confidenceIntervals = {
          avgScore: bootstrap(scores, bootstrapConfig).ci,
          passRate: bootstrap(passes, bootstrapConfig).ci,
        }
      }

      // Performance CIs
      const performanceMetrics = performance[label]
      if (performanceMetrics) {
        performanceMetrics.confidenceIntervals = {
          latencyMean: bootstrap(latencies, bootstrapConfig).ci,
        }
      }
    }
  }

  // Trajectory info
  const trajectoryInfo: Record<string, TrajectoryInfo> = {}
  for (const label of runLabels) {
    const resultsMap = runResults[label] ?? new Map()
    const results = [...resultsMap.values()]
    const stepCounts = results.map((r) => r.trajectory?.length ?? 0)
    const avgStepCount = stepCounts.length > 0 ? stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length : 0

    trajectoryInfo[label] = {
      richness: detectTrajectoryRichness(results),
      avgStepCount,
    }
  }

  // Pairwise comparisons
  const pairwise: PairwiseComparison[] = []
  for (let i = 0; i < runLabels.length; i++) {
    for (let j = i + 1; j < runLabels.length; j++) {
      const runA = runLabels[i]
      const runB = runLabels[j]

      // Skip if labels are undefined (shouldn't happen but TypeScript requires check)
      if (!runA || !runB) continue

      let aWins = 0
      let bWins = 0
      let ties = 0

      for (const pc of promptComparisons) {
        if (pc.winner === runA) aWins++
        else if (pc.winner === runB) bWins++
        else ties++
      }

      pairwise.push({ runA, runB, aWins, bWins, ties })
    }
  }

  // Head-to-head
  const headToHead: HeadToHead = {
    prompts: promptComparisons,
    pairwise,
  }

  // Count prompts where all runs are present
  const promptsWithAllRuns = promptComparisons.filter((pc) => Object.keys(pc.scores).length === runLabels.length).length

  // Build meta
  const meta: ComparisonMeta = {
    generatedAt: new Date().toISOString(),
    runs: runLabels,
    promptCount: promptIds.size,
    promptsWithAllRuns,
  }

  // Assemble report
  const report: ComparisonReport = {
    meta,
    quality,
    performance,
    reliability,
    trajectoryInfo,
    headToHead,
  }

  // Output
  if (format === 'markdown') {
    const markdown = formatReportAsMarkdown(report)
    await writeOutput(markdown, outputPath, false)
  } else {
    await writeOutput(JSON.stringify(report, null, 2), outputPath, false)
  }

  // Summary statistics
  logProgress('', progress)
  logProgress('=== Summary ===', progress)

  const winCounts: Record<string, number> = {}
  for (const label of runLabels) {
    winCounts[label] = 0
  }

  for (const pc of promptComparisons) {
    if (pc.winner && pc.winner in winCounts) {
      const current = winCounts[pc.winner] ?? 0
      winCounts[pc.winner] = current + 1
    }
  }

  for (const [label, wins] of Object.entries(winCounts)) {
    const pct = promptComparisons.length > 0 ? ((wins / promptComparisons.length) * 100).toFixed(1) : '0.0'
    logProgress(`  ${label}: ${wins} wins (${pct}%)`, progress)
  }

  logProgress('Done!', progress)

  return report
}

/**
 * Format comparison report as markdown.
 *
 * @param report - Comparison report
 * @returns Markdown string
 */
const formatReportAsMarkdown = (report: ComparisonReport): string => {
  const lines: string[] = []

  lines.push('# Comparison Report')
  lines.push('')
  lines.push(`Generated: ${report.meta.generatedAt}`)
  lines.push(`Runs: ${report.meta.runs.join(', ')}`)
  lines.push(`Prompts: ${report.meta.promptCount} total, ${report.meta.promptsWithAllRuns} with all runs`)
  lines.push('')

  // Check if any run has confidence intervals (statistical strategy was used)
  const hasCIs = Object.values(report.quality).some((q) => q.confidenceIntervals)

  // Quality table
  lines.push('## Quality')
  lines.push('')
  if (hasCIs) {
    lines.push('| Run | Avg Score | 95% CI | Pass Rate | 95% CI | Pass | Fail |')
    lines.push('|-----|-----------|--------|-----------|--------|------|------|')
    for (const [label, q] of Object.entries(report.quality)) {
      const avgScoreCI = formatCI(q.confidenceIntervals?.avgScore)
      const passRateCI = formatCI(q.confidenceIntervals?.passRate)
      lines.push(
        `| ${label} | ${q.avgScore.toFixed(3)} | ${avgScoreCI} | ${(q.passRate * 100).toFixed(1)}% | ${passRateCI} | ${q.passCount} | ${q.failCount} |`,
      )
    }
  } else {
    lines.push('| Run | Avg Score | Pass Rate | Pass | Fail |')
    lines.push('|-----|-----------|-----------|------|------|')
    for (const [label, q] of Object.entries(report.quality)) {
      lines.push(
        `| ${label} | ${q.avgScore.toFixed(3)} | ${(q.passRate * 100).toFixed(1)}% | ${q.passCount} | ${q.failCount} |`,
      )
    }
  }
  lines.push('')

  // Performance table
  lines.push('## Performance')
  lines.push('')
  if (hasCIs) {
    lines.push('| Run | P50 (ms) | P90 (ms) | P99 (ms) | Mean (ms) | 95% CI |')
    lines.push('|-----|----------|----------|----------|-----------|--------|')
    for (const [label, p] of Object.entries(report.performance)) {
      const latencyCI = formatCI(p.confidenceIntervals?.latencyMean, 0)
      lines.push(
        `| ${label} | ${p.latency.p50.toFixed(0)} | ${p.latency.p90.toFixed(0)} | ${p.latency.p99.toFixed(0)} | ${p.latency.mean.toFixed(0)} | ${latencyCI} |`,
      )
    }
  } else {
    lines.push('| Run | P50 (ms) | P90 (ms) | P99 (ms) | Mean (ms) |')
    lines.push('|-----|----------|----------|----------|-----------|')
    for (const [label, p] of Object.entries(report.performance)) {
      lines.push(
        `| ${label} | ${p.latency.p50.toFixed(0)} | ${p.latency.p90.toFixed(0)} | ${p.latency.p99.toFixed(0)} | ${p.latency.mean.toFixed(0)} |`,
      )
    }
  }
  lines.push('')

  // Reliability table
  lines.push('## Reliability')
  lines.push('')
  lines.push('| Run | Tool Errors | Error Rate | Completion Rate |')
  lines.push('|-----|-------------|------------|-----------------|')
  for (const [label, r] of Object.entries(report.reliability)) {
    lines.push(
      `| ${label} | ${r.toolErrors} | ${(r.toolErrorRate * 100).toFixed(1)}% | ${(r.completionRate * 100).toFixed(1)}% |`,
    )
  }
  lines.push('')

  // Pairwise wins
  lines.push('## Head-to-Head')
  lines.push('')
  lines.push('| Matchup | Wins | Wins | Ties |')
  lines.push('|---------|------|------|------|')
  for (const p of report.headToHead.pairwise) {
    lines.push(`| ${p.runA} vs ${p.runB} | ${p.aWins} | ${p.bWins} | ${p.ties} |`)
  }
  lines.push('')

  return lines.join('\n')
}

/**
 * Pipeline compare command CLI handler.
 *
 * @param args - Command line arguments (after 'compare')
 */
export const compare = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      run: { type: 'string', multiple: true },
      grader: { type: 'string', short: 'g' },
      strategy: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      'input-format': { type: 'string' },
      progress: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness compare [files...] [options]

Compare multiple runs of the same prompts and generate aggregate report.
Supports both CaptureResult (single-run) and TrialResult (multi-run reliability) formats.

Arguments:
  files...          Result files to compare (positional, unlimited)

Options:
  --run             Labeled run format: "label:path.jsonl" (alternative to positional)
  -s, --strategy    Comparison strategy: weighted (default), statistical, or custom
  -g, --grader      Path to custom grader (required if strategy=custom)
  -o, --output      Output file (default: stdout)
  -f, --format      Output format: json (default) or markdown
  --input-format    Input format: auto (default), capture, or trials
  --progress        Show progress to stderr
  -h, --help        Show this help message

Input Formats:
  auto        Auto-detect from file content (default)
  capture     CaptureResult format (trajectory/timing fields)
  trials      TrialResult format (trials/k fields) for pass@k analysis

Built-in Strategies:
  For CaptureResult (capture format):
    weighted      Configurable weights for quality, latency, reliability
                  Env vars: COMPARE_QUALITY, COMPARE_LATENCY, COMPARE_RELIABILITY
    statistical   Bootstrap sampling for confidence intervals
                  Env var: COMPARE_BOOTSTRAP_ITERATIONS

  For TrialResult (trials format):
    weighted      Configurable weights for capability, reliability, consistency
                  Env vars: COMPARE_CAPABILITY, COMPARE_RELIABILITY, COMPARE_CONSISTENCY
    statistical   Bootstrap sampling for passAtK confidence intervals
                  Env var: COMPARE_BOOTSTRAP_ITERATIONS

Custom Grader:
  Must export 'grade' or 'compare' function with signature:
    CaptureResult: (params: ComparisonGraderInput) => Promise<ComparisonGraderResult>
    TrialResult:   (params: TrialsComparisonGraderInput) => Promise<ComparisonGraderResult>

Examples:
  # Default: auto-detect format, weighted strategy, JSON output
  agent-eval-harness compare run1.jsonl run2.jsonl -o comparison.json

  # Explicit trials format for pass@k comparison
  agent-eval-harness compare trials1.jsonl trials2.jsonl --input-format trials -o comparison.json

  # Trials comparison with custom weights
  COMPARE_CAPABILITY=0.5 COMPARE_RELIABILITY=0.3 COMPARE_CONSISTENCY=0.2 \\
    agent-eval-harness compare trials1.jsonl trials2.jsonl -o comparison.json

  # Statistical significance strategy
  agent-eval-harness compare run1.jsonl run2.jsonl --strategy statistical -o comparison.json

  # Markdown report
  agent-eval-harness compare run1.jsonl run2.jsonl --format markdown -o report.md

  # Custom grader
  agent-eval-harness compare run1.jsonl run2.jsonl \\
    --strategy custom --grader ./my-llm-judge.ts -o comparison.json

  # With explicit labels
  agent-eval-harness compare \\
    --run "with-bun-mcp:results-bun.jsonl" \\
    --run "vanilla:results-vanilla.jsonl" \\
    -o comparison.json
`)
    return
  }

  // Collect runs from positional args and --run flags
  const runs: LabeledRun[] = []

  // Positional arguments (file paths)
  for (const arg of positionals) {
    runs.push(parseLabeledRun(arg))
  }

  // --run flags
  if (values.run) {
    for (const arg of values.run) {
      runs.push(parseLabeledRun(arg))
    }
  }

  if (runs.length < 2) {
    console.error('Error: At least 2 result files required for comparison')
    console.error('Example: agent-eval-harness compare run1.jsonl run2.jsonl')
    process.exit(1)
  }

  // Validate that all run files exist (early error for better UX)
  try {
    await validateRunFiles(runs)
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }

  // Validate strategy
  const strategy = (values.strategy as CompareStrategy) ?? 'weighted'
  if (!['weighted', 'statistical', 'custom'].includes(strategy)) {
    console.error(`Error: Invalid strategy '${strategy}'. Use: weighted, statistical, or custom`)
    process.exit(1)
  }

  if (strategy === 'custom' && !values.grader) {
    console.error('Error: --grader is required when using --strategy custom')
    process.exit(1)
  }

  // Validate output format (explicit format takes precedence, otherwise infer from extension)
  const format = inferFormat(values.output, values.format)
  if (values.format && !['json', 'markdown'].includes(values.format)) {
    console.error(`Error: Invalid format '${values.format}'. Use: json or markdown`)
    process.exit(1)
  }

  // Validate input format
  const inputFormatArg = values['input-format']
  if (inputFormatArg && !['auto', 'capture', 'trials'].includes(inputFormatArg)) {
    console.error(`Error: Invalid input-format '${inputFormatArg}'. Use: auto, capture, or trials`)
    process.exit(1)
  }

  // Detect or use specified input format
  let inputFormat: CompareInputFormat
  try {
    if (inputFormatArg === 'capture') {
      inputFormat = 'capture'
    } else if (inputFormatArg === 'trials') {
      inputFormat = 'trials'
    } else {
      // Auto-detect from file content
      inputFormat = await detectAndValidateFormat(runs.map((r) => r.path))
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }

  // Route to appropriate comparison function based on input format
  if (inputFormat === 'trials') {
    await runTrialsCompare({
      runs,
      strategy,
      graderPath: values.grader,
      outputPath: values.output,
      progress: values.progress,
      format,
    })
  } else {
    await runCompare({
      runs,
      strategy,
      graderPath: values.grader,
      outputPath: values.output,
      progress: values.progress,
      format,
    })
  }
}
