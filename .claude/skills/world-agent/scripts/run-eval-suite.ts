#!/usr/bin/env bun
/**
 * Run the full evaluation suite for World Agent.
 *
 * @remarks
 * Orchestrates evaluation of generated templates against stories,
 * comparing baseline (Claude Code one-shots) vs trained World Agent.
 *
 * Usage:
 *   bun scripts/run-eval-suite.ts <eval-dir> [options]
 *
 * Options:
 *   --baseline-only, -b  Only run baseline evaluation
 *   --agent-only, -a     Only run agent evaluation
 *   --output, -o         Output results file (default: eval-dir/results.json)
 *   --verbose, -v        Verbose output
 *   --help, -h           Show this help message
 *
 * Examples:
 *   bun scripts/run-eval-suite.ts .claude/eval
 *   bun scripts/run-eval-suite.ts .claude/eval --baseline-only
 *   bun scripts/run-eval-suite.ts .claude/eval -o ./eval-results.json
 */

import { join } from 'node:path'
import { parseArgs } from 'node:util'

type EvalConfig = {
  baselineModel: string
  templateType: string
  skills: string[]
  metrics: {
    functional: string[]
    quality: string[]
    trajectory: string[]
  }
  thresholds: {
    minStoryPassRate: number
    maxIterations: number
    minA11yScore: number
  }
}

type TestCase = {
  file: string
  exportName: string
  intent: string
}

type EvalResult = {
  testCase: TestCase
  baseline?: GenerationResult
  agent?: GenerationResult
  comparison?: ComparisonResult
}

type GenerationResult = {
  passed: boolean
  a11yPassed: boolean
  iterations: number
  duration: number
  toolCalls: number
  constraintViolations: number
}

type ComparisonResult = {
  baselineWins: boolean
  agentWins: boolean
  tie: boolean
  reason: string
}

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'baseline-only': { type: 'boolean', short: 'b' },
    'agent-only': { type: 'boolean', short: 'a' },
    output: { type: 'string', short: 'o' },
    verbose: { type: 'boolean', short: 'v' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Run the full evaluation suite for World Agent.

Usage:
  bun scripts/run-eval-suite.ts <eval-dir> [options]

Options:
  --baseline-only, -b  Only run baseline evaluation
  --agent-only, -a     Only run agent evaluation
  --output, -o         Output results file (default: eval-dir/results.json)
  --verbose, -v        Verbose output
  --help, -h           Show this help message

Examples:
  bun scripts/run-eval-suite.ts .claude/eval
  bun scripts/run-eval-suite.ts .claude/eval --baseline-only
  bun scripts/run-eval-suite.ts .claude/eval -o ./eval-results.json
`)
  process.exit(values.help ? 0 : 1)
}

const evalDir = positionals[0]!
const outputPath = values.output ?? join(evalDir, 'results.json')
const runBaseline = !values['agent-only']
const runAgent = !values['baseline-only']
const verbose = values.verbose ?? false

const log = (msg: string) => {
  if (verbose) console.error(msg)
}

const loadConfig = async (evalDir: string): Promise<EvalConfig> => {
  const configPath = join(evalDir, 'config.json')
  const file = Bun.file(configPath)

  if (!(await file.exists())) {
    throw new Error(`Config not found: ${configPath}. Run create-world-agent-eval command first.`)
  }

  return file.json()
}

const discoverTestCases = async (evalDir: string): Promise<TestCase[]> => {
  const templatesDir = join(evalDir, 'templates')
  const glob = new Bun.Glob('**/*.stories.tsx')
  const testCases: TestCase[] = []

  for await (const file of glob.scan(templatesDir)) {
    const fullPath = join(templatesDir, file)
    const content = await Bun.file(fullPath).text()

    // Extract meta.intent from story file
    const intentMatch = content.match(/intent:\s*['"]([^'"]+)['"]/)
    const exportMatches = content.matchAll(/export\s+const\s+(\w+)\s*=/g)

    for (const match of exportMatches) {
      const exportName = match[1]!
      if (exportName === 'meta') continue

      testCases.push({
        file: fullPath,
        exportName,
        intent: intentMatch?.[1] ?? `Generate ${exportName}`,
      })
    }
  }

  return testCases
}

const runBaselineEval = async (testCase: TestCase, _config: EvalConfig): Promise<GenerationResult> => {
  log(`  Running baseline for: ${testCase.exportName}`)

  // In a real implementation, this would:
  // 1. Invoke Claude Code with the skills specified in config
  // 2. Run the generated template against the story
  // 3. Collect metrics

  // For now, return a placeholder that indicates the structure
  return {
    passed: false,
    a11yPassed: false,
    iterations: 1,
    duration: 0,
    toolCalls: 0,
    constraintViolations: 0,
  }
}

const runAgentEval = async (testCase: TestCase, _config: EvalConfig): Promise<GenerationResult> => {
  log(`  Running agent for: ${testCase.exportName}`)

  // In a real implementation, this would:
  // 1. Invoke the World Agent with the intent
  // 2. Run the generated template against the story
  // 3. Collect trajectory metrics (bThread blocking, tool efficiency)

  return {
    passed: false,
    a11yPassed: false,
    iterations: 1,
    duration: 0,
    toolCalls: 0,
    constraintViolations: 0,
  }
}

const compareResults = (baseline?: GenerationResult, agent?: GenerationResult): ComparisonResult | undefined => {
  if (!baseline || !agent) return undefined

  // Scoring: passed (50%) + a11y (30%) + efficiency (20%)
  const baselineScore =
    (baseline.passed ? 50 : 0) + (baseline.a11yPassed ? 30 : 0) + (baseline.iterations <= 1 ? 20 : 0)

  const agentScore = (agent.passed ? 50 : 0) + (agent.a11yPassed ? 30 : 0) + (agent.iterations <= 1 ? 20 : 0)

  if (agentScore > baselineScore) {
    return {
      baselineWins: false,
      agentWins: true,
      tie: false,
      reason: `Agent score (${agentScore}) > Baseline score (${baselineScore})`,
    }
  } else if (baselineScore > agentScore) {
    return {
      baselineWins: true,
      agentWins: false,
      tie: false,
      reason: `Baseline score (${baselineScore}) > Agent score (${agentScore})`,
    }
  } else {
    return {
      baselineWins: false,
      agentWins: false,
      tie: true,
      reason: `Both scored ${agentScore}`,
    }
  }
}

const main = async () => {
  console.error(`\nWorld Agent Evaluation Suite`)
  console.error(`============================\n`)

  const config = await loadConfig(evalDir)
  console.error(`Loaded config from: ${evalDir}/config.json`)
  console.error(`Baseline model: ${config.baselineModel}`)
  console.error(`Template type: ${config.templateType}\n`)

  const testCases = await discoverTestCases(evalDir)
  console.error(`Discovered ${testCases.length} test cases\n`)

  if (testCases.length === 0) {
    console.error('No test cases found. Add story files to eval/templates/')
    process.exit(1)
  }

  const results: EvalResult[] = []

  for (const testCase of testCases) {
    console.error(`Evaluating: ${testCase.exportName}`)
    log(`  Intent: ${testCase.intent}`)

    const result: EvalResult = { testCase }

    if (runBaseline) {
      result.baseline = await runBaselineEval(testCase, config)
    }

    if (runAgent) {
      result.agent = await runAgentEval(testCase, config)
    }

    result.comparison = compareResults(result.baseline, result.agent)
    results.push(result)
  }

  // Summary
  console.error(`\n--- Summary ---\n`)

  const baselineWins = results.filter((r) => r.comparison?.baselineWins).length
  const agentWins = results.filter((r) => r.comparison?.agentWins).length
  const ties = results.filter((r) => r.comparison?.tie).length

  if (runBaseline && runAgent) {
    console.error(`Baseline wins: ${baselineWins}`)
    console.error(`Agent wins: ${agentWins}`)
    console.error(`Ties: ${ties}`)
  }

  if (runBaseline) {
    const baselinePassRate = results.filter((r) => r.baseline?.passed).length / results.length
    console.error(`Baseline pass rate: ${(baselinePassRate * 100).toFixed(1)}%`)
  }

  if (runAgent) {
    const agentPassRate = results.filter((r) => r.agent?.passed).length / results.length
    console.error(`Agent pass rate: ${(agentPassRate * 100).toFixed(1)}%`)
  }

  // Write results
  const output = {
    evalDir,
    timestamp: new Date().toISOString(),
    config,
    summary: {
      totalTests: results.length,
      baselineWins,
      agentWins,
      ties,
    },
    results,
  }

  await Bun.write(outputPath, JSON.stringify(output, null, 2))
  console.error(`\nResults written to: ${outputPath}`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
