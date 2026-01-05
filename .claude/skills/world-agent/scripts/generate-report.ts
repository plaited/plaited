#!/usr/bin/env bun
/**
 * Generate human-readable evaluation report.
 *
 * @remarks
 * Creates a comprehensive report from evaluation results,
 * including trajectory analysis, metric breakdowns, and
 * recommendations for agent improvement.
 *
 * Usage:
 *   bun scripts/generate-report.ts <eval-dir> [options]
 *
 * Options:
 *   --output, -o   Output file (default: eval-dir/report.md)
 *   --format, -f   Output format: markdown | html (default: markdown)
 *   --help, -h     Show this help message
 *
 * Examples:
 *   bun scripts/generate-report.ts .claude/eval
 *   bun scripts/generate-report.ts .claude/eval -o ./report.md
 *   bun scripts/generate-report.ts .claude/eval --format html
 */

import { join } from 'node:path'
import { parseArgs } from 'node:util'

type EvalResults = {
  evalDir: string
  timestamp: string
  config: {
    baselineModel: string
    templateType: string
    thresholds: {
      minStoryPassRate: number
      maxIterations: number
    }
  }
  summary: {
    totalTests: number
    baselineWins: number
    agentWins: number
    ties: number
  }
  results: Array<{
    testCase: { exportName: string; intent: string; file: string }
    baseline?: { passed: boolean; a11yPassed: boolean; iterations: number; duration: number; toolCalls: number }
    agent?: {
      passed: boolean
      a11yPassed: boolean
      iterations: number
      duration: number
      toolCalls: number
      constraintViolations: number
    }
    comparison?: { baselineWins: boolean; agentWins: boolean; tie: boolean; reason: string }
  }>
}

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o' },
    format: { type: 'string', short: 'f', default: 'markdown' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Generate human-readable evaluation report.

Usage:
  bun scripts/generate-report.ts <eval-dir> [options]

Options:
  --output, -o   Output file (default: eval-dir/report.md)
  --format, -f   Output format: markdown | html (default: markdown)
  --help, -h     Show this help message

Examples:
  bun scripts/generate-report.ts .claude/eval
  bun scripts/generate-report.ts .claude/eval -o ./report.md
  bun scripts/generate-report.ts .claude/eval --format html
`)
  process.exit(values.help ? 0 : 1)
}

const evalDir = positionals[0]!
const format = values.format as 'markdown' | 'html'
const outputPath = values.output ?? join(evalDir, format === 'html' ? 'report.html' : 'report.md')

const loadResults = async (evalDir: string): Promise<EvalResults> => {
  const resultsPath = join(evalDir, 'results.json')
  const file = Bun.file(resultsPath)

  if (!(await file.exists())) {
    throw new Error(`Results not found: ${resultsPath}. Run run-eval-suite.ts first.`)
  }

  return file.json()
}

const calculateAgentMetrics = (results: EvalResults['results']) => {
  const agentResults = results.filter((r) => r.agent)

  if (agentResults.length === 0) return null

  const passRate = agentResults.filter((r) => r.agent?.passed).length / agentResults.length
  const a11yRate = agentResults.filter((r) => r.agent?.a11yPassed).length / agentResults.length
  const avgIterations = agentResults.reduce((sum, r) => sum + (r.agent?.iterations ?? 0), 0) / agentResults.length
  const avgToolCalls = agentResults.reduce((sum, r) => sum + (r.agent?.toolCalls ?? 0), 0) / agentResults.length
  const totalViolations = agentResults.reduce((sum, r) => sum + (r.agent?.constraintViolations ?? 0), 0)

  return { passRate, a11yRate, avgIterations, avgToolCalls, totalViolations }
}

const calculateBaselineMetrics = (results: EvalResults['results']) => {
  const baselineResults = results.filter((r) => r.baseline)

  if (baselineResults.length === 0) return null

  const passRate = baselineResults.filter((r) => r.baseline?.passed).length / baselineResults.length
  const a11yRate = baselineResults.filter((r) => r.baseline?.a11yPassed).length / baselineResults.length
  const avgIterations =
    baselineResults.reduce((sum, r) => sum + (r.baseline?.iterations ?? 0), 0) / baselineResults.length
  const avgToolCalls =
    baselineResults.reduce((sum, r) => sum + (r.baseline?.toolCalls ?? 0), 0) / baselineResults.length

  return { passRate, a11yRate, avgIterations, avgToolCalls }
}

const generateRecommendations = (
  agentMetrics: ReturnType<typeof calculateAgentMetrics>,
  baselineMetrics: ReturnType<typeof calculateBaselineMetrics>,
  thresholds: EvalResults['config']['thresholds'],
): string[] => {
  const recommendations: string[] = []

  if (!agentMetrics) return ['Run agent evaluation to generate recommendations.']

  if (agentMetrics.passRate < thresholds.minStoryPassRate) {
    recommendations.push(`Story pass rate (${(agentMetrics.passRate * 100).toFixed(1)}%) is below threshold (${thresholds.minStoryPassRate * 100}%). Consider:
    - Reviewing failed test cases for common patterns
    - Adding more training trajectories for failed scenarios
    - Adjusting constraint bThreads if blocking valid generations`)
  }

  if (agentMetrics.avgIterations > thresholds.maxIterations) {
    recommendations.push(`Average iterations (${agentMetrics.avgIterations.toFixed(1)}) exceeds threshold (${thresholds.maxIterations}). Consider:
    - Improving pattern registry coverage
    - Adjusting tool discovery weights
    - Reviewing constraint blocking patterns`)
  }

  if (agentMetrics.totalViolations > 0) {
    recommendations.push(`Agent had ${agentMetrics.totalViolations} constraint violations. Consider:
    - Reviewing bThread blocking rules
    - Adding training data that avoids these patterns
    - Adjusting reward weights for constraint compliance`)
  }

  if (baselineMetrics && agentMetrics.passRate < baselineMetrics.passRate) {
    recommendations.push(`Agent pass rate is lower than baseline. Consider:
    - More training iterations
    - Larger trajectory dataset
    - Reviewing reward function weights`)
  }

  if (recommendations.length === 0) {
    recommendations.push('Agent is performing well across all metrics. Consider expanding test coverage.')
  }

  return recommendations
}

const generateMarkdownReport = (data: EvalResults): string => {
  const agentMetrics = calculateAgentMetrics(data.results)
  const baselineMetrics = calculateBaselineMetrics(data.results)
  const recommendations = generateRecommendations(agentMetrics, baselineMetrics, data.config.thresholds)

  let md = `# World Agent Evaluation Report

**Generated:** ${new Date(data.timestamp).toLocaleString()}
**Eval Directory:** ${data.evalDir}
**Baseline Model:** ${data.config.baselineModel}
**Template Type:** ${data.config.templateType}

---

## Executive Summary

| Metric | Baseline | Agent | Winner |
|--------|----------|-------|--------|
| Tests Run | ${data.summary.totalTests} | ${data.summary.totalTests} | - |
| Wins | ${data.summary.baselineWins} | ${data.summary.agentWins} | ${data.summary.agentWins > data.summary.baselineWins ? '**Agent**' : data.summary.baselineWins > data.summary.agentWins ? '**Baseline**' : 'Tie'} |

`

  if (baselineMetrics) {
    md += `### Baseline Metrics (Claude Code One-Shot)

| Metric | Value |
|--------|-------|
| Pass Rate | ${(baselineMetrics.passRate * 100).toFixed(1)}% |
| A11y Pass Rate | ${(baselineMetrics.a11yRate * 100).toFixed(1)}% |
| Avg Iterations | ${baselineMetrics.avgIterations.toFixed(1)} |
| Avg Tool Calls | ${baselineMetrics.avgToolCalls.toFixed(1)} |

`
  }

  if (agentMetrics) {
    md += `### Agent Metrics (World Agent)

| Metric | Value | Threshold |
|--------|-------|-----------|
| Pass Rate | ${(agentMetrics.passRate * 100).toFixed(1)}% | ${data.config.thresholds.minStoryPassRate * 100}% |
| A11y Pass Rate | ${(agentMetrics.a11yRate * 100).toFixed(1)}% | 100% |
| Avg Iterations | ${agentMetrics.avgIterations.toFixed(1)} | ${data.config.thresholds.maxIterations} |
| Avg Tool Calls | ${agentMetrics.avgToolCalls.toFixed(1)} | - |
| Constraint Violations | ${agentMetrics.totalViolations} | 0 |

`
  }

  md += `---

## Test Results Detail

`

  for (const result of data.results) {
    const winner = result.comparison?.agentWins ? 'Agent' : result.comparison?.baselineWins ? 'Baseline' : 'Tie'
    const icon = result.comparison?.agentWins ? '✅' : result.comparison?.baselineWins ? '⚠️' : '➖'

    md += `### ${icon} ${result.testCase.exportName}

**Intent:** ${result.testCase.intent}
**Winner:** ${winner}

| Metric | Baseline | Agent |
|--------|----------|-------|
| Passed | ${result.baseline?.passed ?? '-'} | ${result.agent?.passed ?? '-'} |
| A11y | ${result.baseline?.a11yPassed ?? '-'} | ${result.agent?.a11yPassed ?? '-'} |
| Iterations | ${result.baseline?.iterations ?? '-'} | ${result.agent?.iterations ?? '-'} |
| Tool Calls | ${result.baseline?.toolCalls ?? '-'} | ${result.agent?.toolCalls ?? '-'} |

`
  }

  md += `---

## Recommendations

`

  for (const rec of recommendations) {
    md += `- ${rec}\n`
  }

  md += `
---

## Next Steps

1. Address recommendations above
2. Generate additional training trajectories for failed cases
3. Re-run evaluation: \`bun scripts/run-eval-suite.ts ${data.evalDir}\`
4. Compare results: \`bun scripts/compare-baseline.ts ${data.evalDir}\`
`

  return md
}

const wrapInHtml = (markdown: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>World Agent Evaluation Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    h2 { border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; margin-top: 2rem; }
    h3 { margin-top: 1.5rem; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto; }
    hr { margin: 2rem 0; border: none; border-top: 1px solid #ddd; }
  </style>
</head>
<body>
<pre>${markdown}</pre>
</body>
</html>`
}

const main = async () => {
  const data = await loadResults(evalDir)

  let output: string
  if (format === 'markdown') {
    output = generateMarkdownReport(data)
  } else {
    output = wrapInHtml(generateMarkdownReport(data))
  }

  await Bun.write(outputPath, output)
  console.error(`Report generated: ${outputPath}`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
