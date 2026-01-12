#!/usr/bin/env bun
/**
 * Compare Claude Code one-shot generation vs World Agent.
 *
 * @remarks
 * Runs side-by-side comparison for a single test case or all test cases,
 * showing detailed metrics for baseline (Claude Code with skills) vs
 * the purpose-trained World Agent.
 *
 * Usage:
 *   bun scripts/compare-baseline.ts <eval-dir> [options]
 *
 * Options:
 *   --test, -t     Specific test case to compare (export name)
 *   --output, -o   Output file (default: stdout as JSON)
 *   --format, -f   Output format: json | markdown (default: json)
 *   --help, -h     Show this help message
 *
 * Examples:
 *   bun scripts/compare-baseline.ts .claude/eval
 *   bun scripts/compare-baseline.ts .claude/eval --test PrimaryButton
 *   bun scripts/compare-baseline.ts .claude/eval --format markdown -o comparison.md
 */

import { join } from 'node:path'
import { parseArgs } from 'node:util'

type ComparisonMetric = {
  name: string
  baseline: number | boolean | string
  agent: number | boolean | string
  winner: 'baseline' | 'agent' | 'tie'
}

type DetailedComparison = {
  testCase: string
  intent: string
  metrics: ComparisonMetric[]
  overallWinner: 'baseline' | 'agent' | 'tie'
  analysis: string
}

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    test: { type: 'string', short: 't' },
    output: { type: 'string', short: 'o' },
    format: { type: 'string', short: 'f', default: 'json' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Compare Claude Code one-shot generation vs World Agent.

Usage:
  bun scripts/compare-baseline.ts <eval-dir> [options]

Options:
  --test, -t     Specific test case to compare (export name)
  --output, -o   Output file (default: stdout as JSON)
  --format, -f   Output format: json | markdown (default: json)
  --help, -h     Show this help message

Examples:
  bun scripts/compare-baseline.ts .claude/eval
  bun scripts/compare-baseline.ts .claude/eval --test PrimaryButton
  bun scripts/compare-baseline.ts .claude/eval --format markdown -o comparison.md
`)
  process.exit(values.help ? 0 : 1)
}

const evalDir = positionals[0]!
const testFilter = values.test
const format = values.format as 'json' | 'markdown'

type EvalResults = {
  results: Array<{
    testCase: { exportName: string; intent: string }
    baseline?: { passed: boolean; a11yPassed: boolean; iterations: number; toolCalls: number }
    agent?: {
      passed: boolean
      a11yPassed: boolean
      iterations: number
      toolCalls: number
      constraintViolations: number
    }
  }>
}

const loadResults = async (evalDir: string): Promise<EvalResults> => {
  const resultsPath = join(evalDir, 'results.json')
  const file = Bun.file(resultsPath)

  if (!(await file.exists())) {
    throw new Error(`Results not found: ${resultsPath}. Run run-eval-suite.ts first.`)
  }

  return file.json()
}

const compareMetrics = (
  baseline: EvalResults['results'][0]['baseline'],
  agent: EvalResults['results'][0]['agent'],
): ComparisonMetric[] => {
  if (!baseline || !agent) return []

  const metrics: ComparisonMetric[] = []

  // Story pass
  metrics.push({
    name: 'Story Passed',
    baseline: baseline.passed,
    agent: agent.passed,
    winner: baseline.passed === agent.passed ? 'tie' : agent.passed ? 'agent' : 'baseline',
  })

  // A11y pass
  metrics.push({
    name: 'A11y Passed',
    baseline: baseline.a11yPassed,
    agent: agent.a11yPassed,
    winner: baseline.a11yPassed === agent.a11yPassed ? 'tie' : agent.a11yPassed ? 'agent' : 'baseline',
  })

  // Iterations (lower is better)
  metrics.push({
    name: 'Iterations',
    baseline: baseline.iterations,
    agent: agent.iterations,
    winner:
      baseline.iterations === agent.iterations ? 'tie' : agent.iterations < baseline.iterations ? 'agent' : 'baseline',
  })

  // Tool calls (lower is better for efficiency)
  metrics.push({
    name: 'Tool Calls',
    baseline: baseline.toolCalls,
    agent: agent.toolCalls,
    winner:
      baseline.toolCalls === agent.toolCalls ? 'tie' : agent.toolCalls < baseline.toolCalls ? 'agent' : 'baseline',
  })

  // Constraint violations (agent only, lower is better)
  if ('constraintViolations' in agent) {
    metrics.push({
      name: 'Constraint Violations',
      baseline: 'N/A',
      agent: agent.constraintViolations,
      winner: agent.constraintViolations === 0 ? 'agent' : 'baseline',
    })
  }

  return metrics
}

const determineOverallWinner = (metrics: ComparisonMetric[]): 'baseline' | 'agent' | 'tie' => {
  const agentWins = metrics.filter((m) => m.winner === 'agent').length
  const baselineWins = metrics.filter((m) => m.winner === 'baseline').length

  if (agentWins > baselineWins) return 'agent'
  if (baselineWins > agentWins) return 'baseline'
  return 'tie'
}

const generateAnalysis = (metrics: ComparisonMetric[], winner: 'baseline' | 'agent' | 'tie'): string => {
  const strengths: string[] = []
  const weaknesses: string[] = []

  for (const metric of metrics) {
    if (metric.winner === 'agent') {
      strengths.push(`${metric.name}: Agent outperformed (${metric.agent} vs ${metric.baseline})`)
    } else if (metric.winner === 'baseline') {
      weaknesses.push(`${metric.name}: Baseline outperformed (${metric.baseline} vs ${metric.agent})`)
    }
  }

  if (winner === 'agent') {
    return `Agent wins. Strengths: ${strengths.join(', ') || 'None'}`
  } else if (winner === 'baseline') {
    return `Baseline wins. Agent weaknesses: ${weaknesses.join(', ') || 'None'}`
  }
  return 'Tie. Both performed equally.'
}

const formatAsMarkdown = (comparisons: DetailedComparison[]): string => {
  let md = '# World Agent vs Baseline Comparison\n\n'

  for (const comp of comparisons) {
    md += `## ${comp.testCase}\n\n`
    md += `**Intent:** ${comp.intent}\n\n`
    md += `**Winner:** ${comp.overallWinner}\n\n`

    md += '| Metric | Baseline | Agent | Winner |\n'
    md += '|--------|----------|-------|--------|\n'

    for (const m of comp.metrics) {
      md += `| ${m.name} | ${m.baseline} | ${m.agent} | ${m.winner} |\n`
    }

    md += `\n**Analysis:** ${comp.analysis}\n\n---\n\n`
  }

  // Summary
  const agentWins = comparisons.filter((c) => c.overallWinner === 'agent').length
  const baselineWins = comparisons.filter((c) => c.overallWinner === 'baseline').length
  const ties = comparisons.filter((c) => c.overallWinner === 'tie').length

  md += '## Summary\n\n'
  md += `- **Agent wins:** ${agentWins}\n`
  md += `- **Baseline wins:** ${baselineWins}\n`
  md += `- **Ties:** ${ties}\n`

  return md
}

const main = async () => {
  const data = await loadResults(evalDir)

  let results = data.results
  if (testFilter) {
    results = results.filter((r) => r.testCase.exportName === testFilter)
    if (results.length === 0) {
      console.error(`No results found for test: ${testFilter}`)
      process.exit(1)
    }
  }

  const comparisons: DetailedComparison[] = results.map((r) => {
    const metrics = compareMetrics(r.baseline, r.agent)
    const winner = determineOverallWinner(metrics)

    return {
      testCase: r.testCase.exportName,
      intent: r.testCase.intent,
      metrics,
      overallWinner: winner,
      analysis: generateAnalysis(metrics, winner),
    }
  })

  let output: string
  if (format === 'markdown') {
    output = formatAsMarkdown(comparisons)
  } else {
    output = JSON.stringify(comparisons, null, 2)
  }

  if (values.output) {
    await Bun.write(values.output, output)
    console.error(`Written to: ${values.output}`)
  } else {
    console.log(output)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
