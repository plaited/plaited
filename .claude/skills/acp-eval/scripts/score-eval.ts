#!/usr/bin/env bun

/**
 * Compute evaluation metrics from results.
 *
 * @remarks
 * Analyzes evaluation results and computes metrics including
 * accuracy, latency, tool usage, and error rates.
 *
 * Usage:
 *   bun scripts/score-eval.ts <results-dir> --metrics <metric-list>
 *
 * Example:
 *   bun scripts/score-eval.ts results/ --metrics accuracy,latency,tool-usage
 */

import { parseArgs } from 'node:util'
import { Glob } from 'bun'

// ============================================================================
// Types
// ============================================================================

type EvalResult = {
  id: string
  status: 'passed' | 'failed' | 'error' | 'timeout'
  response: string
  toolCalls: Array<{
    name: string
    status: string
    duration?: number
  }>
  timing: {
    startTime: number
    firstResponseTime?: number
    endTime: number
    totalDuration: number
  }
  errors?: string[]
  updates: number
}

type MetricScores = {
  accuracy: {
    passRate: number
    passed: number
    total: number
  }
  latency: {
    avgDuration: number
    minDuration: number
    maxDuration: number
    p50Duration: number
    p95Duration: number
  }
  toolUsage: {
    avgToolCalls: number
    totalToolCalls: number
    uniqueTools: string[]
    toolDistribution: Record<string, number>
  }
  errors: {
    errorRate: number
    timeoutRate: number
    errorTypes: Record<string, number>
  }
}

// ============================================================================
// Argument Parsing
// ============================================================================

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    metrics: {
      type: 'string',
      short: 'm',
      default: 'accuracy,latency,tool-usage,errors',
    },
    format: {
      type: 'string',
      short: 'f',
      default: 'table',
    },
    compare: {
      type: 'string',
      description: 'Compare with another results directory',
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Usage: bun scripts/score-eval.ts <results-dir> [options]

Arguments:
  results-dir     Directory with evaluation results

Options:
  -m, --metrics   Comma-separated metrics (default: accuracy,latency,tool-usage,errors)
  -f, --format    Output format: json, markdown, table (default: table)
  --compare       Compare with another results directory
  -h, --help      Show this help message

Available metrics:
  accuracy     - Pass rate and completion
  latency      - Timing statistics
  tool-usage   - Tool call patterns
  errors       - Error and timeout rates

Example:
  bun scripts/score-eval.ts results/ --format markdown
  bun scripts/score-eval.ts results/claude --compare results/droid
`)
  process.exit(values.help ? 0 : 1)
}

// ============================================================================
// Metric Computation
// ============================================================================

/**
 * Load all results from a directory
 */
const loadResults = async (dir: string): Promise<EvalResult[]> => {
  const results: EvalResult[] = []
  const glob = new Glob('*.json')

  for await (const file of glob.scan({ cwd: dir, absolute: true })) {
    if (file.endsWith('summary.json')) continue

    try {
      const content = await Bun.file(file).json()
      results.push(content as EvalResult)
    } catch {
      // Skip invalid files
    }
  }

  return results
}

/**
 * Compute percentile from sorted array
 */
const percentile = (sorted: number[], p: number): number => {
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)] ?? 0
}

/**
 * Compute all metrics from results
 */
const computeMetrics = (results: EvalResult[]): MetricScores => {
  const passed = results.filter((r) => r.status === 'passed').length
  const errors = results.filter((r) => r.status === 'error').length
  const timeouts = results.filter((r) => r.status === 'timeout').length

  // Latency
  const durations = results.map((r) => r.timing.totalDuration).sort((a, b) => a - b)
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length

  // Tool usage
  const allToolCalls = results.flatMap((r) => r.toolCalls)
  const toolCounts = new Map<string, number>()
  for (const call of allToolCalls) {
    toolCounts.set(call.name, (toolCounts.get(call.name) ?? 0) + 1)
  }

  // Error types
  const errorTypes = new Map<string, number>()
  for (const result of results) {
    if (result.errors) {
      for (const error of result.errors) {
        const key = error.slice(0, 50) // Truncate for grouping
        errorTypes.set(key, (errorTypes.get(key) ?? 0) + 1)
      }
    }
  }

  return {
    accuracy: {
      passRate: results.length > 0 ? passed / results.length : 0,
      passed,
      total: results.length,
    },
    latency: {
      avgDuration,
      minDuration: durations[0] ?? 0,
      maxDuration: durations[durations.length - 1] ?? 0,
      p50Duration: percentile(durations, 50),
      p95Duration: percentile(durations, 95),
    },
    toolUsage: {
      avgToolCalls: results.length > 0 ? allToolCalls.length / results.length : 0,
      totalToolCalls: allToolCalls.length,
      uniqueTools: [...toolCounts.keys()],
      toolDistribution: Object.fromEntries(toolCounts),
    },
    errors: {
      errorRate: results.length > 0 ? errors / results.length : 0,
      timeoutRate: results.length > 0 ? timeouts / results.length : 0,
      errorTypes: Object.fromEntries(errorTypes),
    },
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

/**
 * Format metrics as table
 */
const formatTable = (metrics: MetricScores, requestedMetrics: string[]): string => {
  const lines: string[] = []

  if (requestedMetrics.includes('accuracy')) {
    lines.push('Accuracy')
    lines.push('─'.repeat(40))
    lines.push(`  Pass Rate: ${(metrics.accuracy.passRate * 100).toFixed(1)}%`)
    lines.push(`  Passed:    ${metrics.accuracy.passed}/${metrics.accuracy.total}`)
    lines.push('')
  }

  if (requestedMetrics.includes('latency')) {
    lines.push('Latency')
    lines.push('─'.repeat(40))
    lines.push(`  Average:   ${metrics.latency.avgDuration.toFixed(0)}ms`)
    lines.push(`  Min:       ${metrics.latency.minDuration.toFixed(0)}ms`)
    lines.push(`  Max:       ${metrics.latency.maxDuration.toFixed(0)}ms`)
    lines.push(`  P50:       ${metrics.latency.p50Duration.toFixed(0)}ms`)
    lines.push(`  P95:       ${metrics.latency.p95Duration.toFixed(0)}ms`)
    lines.push('')
  }

  if (requestedMetrics.includes('tool-usage')) {
    lines.push('Tool Usage')
    lines.push('─'.repeat(40))
    lines.push(`  Avg Calls: ${metrics.toolUsage.avgToolCalls.toFixed(1)}`)
    lines.push(`  Total:     ${metrics.toolUsage.totalToolCalls}`)
    lines.push(`  Tools:     ${metrics.toolUsage.uniqueTools.join(', ') || 'none'}`)
    lines.push('')
  }

  if (requestedMetrics.includes('errors')) {
    lines.push('Errors')
    lines.push('─'.repeat(40))
    lines.push(`  Error Rate:   ${(metrics.errors.errorRate * 100).toFixed(1)}%`)
    lines.push(`  Timeout Rate: ${(metrics.errors.timeoutRate * 100).toFixed(1)}%`)
    if (Object.keys(metrics.errors.errorTypes).length > 0) {
      lines.push('  Types:')
      for (const [type, count] of Object.entries(metrics.errors.errorTypes)) {
        lines.push(`    - ${type}: ${count}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format metrics as markdown
 */
const formatMarkdown = (metrics: MetricScores, requestedMetrics: string[]): string => {
  const lines: string[] = ['# Evaluation Metrics', '']

  if (requestedMetrics.includes('accuracy')) {
    lines.push('## Accuracy')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Pass Rate | ${(metrics.accuracy.passRate * 100).toFixed(1)}% |`)
    lines.push(`| Passed | ${metrics.accuracy.passed}/${metrics.accuracy.total} |`)
    lines.push('')
  }

  if (requestedMetrics.includes('latency')) {
    lines.push('## Latency')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Average | ${metrics.latency.avgDuration.toFixed(0)}ms |`)
    lines.push(`| Min | ${metrics.latency.minDuration.toFixed(0)}ms |`)
    lines.push(`| Max | ${metrics.latency.maxDuration.toFixed(0)}ms |`)
    lines.push(`| P50 | ${metrics.latency.p50Duration.toFixed(0)}ms |`)
    lines.push(`| P95 | ${metrics.latency.p95Duration.toFixed(0)}ms |`)
    lines.push('')
  }

  if (requestedMetrics.includes('tool-usage')) {
    lines.push('## Tool Usage')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Avg Calls | ${metrics.toolUsage.avgToolCalls.toFixed(1)} |`)
    lines.push(`| Total | ${metrics.toolUsage.totalToolCalls} |`)
    lines.push(`| Unique Tools | ${metrics.toolUsage.uniqueTools.length} |`)
    lines.push('')

    if (Object.keys(metrics.toolUsage.toolDistribution).length > 0) {
      lines.push('### Tool Distribution')
      lines.push('')
      lines.push('| Tool | Count |')
      lines.push('|------|-------|')
      for (const [tool, count] of Object.entries(metrics.toolUsage.toolDistribution)) {
        lines.push(`| ${tool} | ${count} |`)
      }
      lines.push('')
    }
  }

  if (requestedMetrics.includes('errors')) {
    lines.push('## Errors')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Error Rate | ${(metrics.errors.errorRate * 100).toFixed(1)}% |`)
    lines.push(`| Timeout Rate | ${(metrics.errors.timeoutRate * 100).toFixed(1)}% |`)
    lines.push('')
  }

  return lines.join('\n')
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const resultsDir = positionals[0]
  const requestedMetrics = (values.metrics ?? 'accuracy,latency,tool-usage,errors').split(',')
  const format = values.format ?? 'table'

  // Load results
  const results = await loadResults(resultsDir)

  if (results.length === 0) {
    console.error(`No results found in ${resultsDir}`)
    process.exit(1)
  }

  console.log(`Loaded ${results.length} results from ${resultsDir}\n`)

  // Compute metrics
  const metrics = computeMetrics(results)

  // Format output
  switch (format) {
    case 'json':
      console.log(JSON.stringify(metrics, null, 2))
      break
    case 'markdown':
      console.log(formatMarkdown(metrics, requestedMetrics))
      break
    default:
      console.log(formatTable(metrics, requestedMetrics))
  }

  // Compare if requested
  if (values.compare) {
    const compareResults = await loadResults(values.compare)
    if (compareResults.length > 0) {
      const compareMetrics = computeMetrics(compareResults)

      console.log(`\n${'═'.repeat(50)}`)
      console.log('Comparison')
      console.log(`${'═'.repeat(50)}\n`)

      const passRateDiff = metrics.accuracy.passRate - compareMetrics.accuracy.passRate
      const latencyDiff = metrics.latency.avgDuration - compareMetrics.latency.avgDuration

      console.log(`Pass Rate: ${passRateDiff >= 0 ? '+' : ''}${(passRateDiff * 100).toFixed(1)}%`)
      console.log(`Latency:   ${latencyDiff >= 0 ? '+' : ''}${latencyDiff.toFixed(0)}ms`)
    }
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
