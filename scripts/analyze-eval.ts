#!/usr/bin/env bun

/**
 * Analyze eval results — pass@k by domain, difficulty, and dimension.
 * Identifies skill gaps and common failure patterns.
 *
 * Usage:
 *   bun scripts/analyze-eval.ts <results.jsonl>
 *   bun scripts/analyze-eval.ts   # auto-finds latest in /tmp/module-eval/
 */

import { resolve } from 'node:path'

// ============================================================================
// Types
// ============================================================================

type TrialEntry = {
  trialNum: number
  output: string
  duration: number
  pass?: boolean
  score?: number
  reasoning?: string
  outcome?: Record<string, unknown>
  timing?: { total?: number; inputTokens?: number; outputTokens?: number }
}

type TrialResult = {
  id: string
  input: string | string[]
  k: number
  passRate?: number
  passAtK?: number
  passExpK?: number
  trials: TrialEntry[]
  metadata?: Record<string, unknown>
}

type DimensionScores = {
  intention: number[]
  static: number[]
  dynamic: number[]
}

type StaticCheck = { name: string; pass: boolean; error?: string }

// ============================================================================
// Loading
// ============================================================================

const findLatestResults = async (): Promise<string> => {
  const dir = '/tmp/module-eval'
  const proc = Bun.spawnSync(['find', dir, '-name', 'results-*.jsonl', '-maxdepth', '1'], {
    stdout: 'pipe',
  })
  const files = proc.stdout.toString().trim().split('\n').filter(Boolean)
  if (files.length === 0) throw new Error(`No results found in ${dir}`)
  files.sort()
  return files[files.length - 1]!
}

const loadJsonl = async (path: string): Promise<TrialResult[]> => {
  const content = await Bun.file(path).text()
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrialResult)
}

// ============================================================================
// Analysis
// ============================================================================

const analyzeResults = (results: TrialResult[]) => {
  const byDomain: Record<string, TrialResult[]> = {}
  const byDifficulty: Record<string, TrialResult[]> = {}
  const dimensions: Record<string, DimensionScores> = {}
  const staticFailures: Record<string, number> = {}
  const intentionFailures: Record<string, number> = {}
  const dynamicFailures: Record<string, number> = {}
  const _totalCost = 0
  let totalTokensIn = 0
  let totalTokensOut = 0

  for (const result of results) {
    const meta = result.metadata as Record<string, unknown> | undefined
    const domain = (meta?.domain as string) ?? 'unknown'
    const difficulty = (meta?.difficulty as string) ?? 'unknown'

    if (!byDomain[domain]) byDomain[domain] = []
    byDomain[domain]!.push(result)

    if (!byDifficulty[difficulty]) byDifficulty[difficulty] = []
    byDifficulty[difficulty]!.push(result)

    // Extract dimension scores and failure patterns
    for (const trial of result.trials) {
      const outcome = trial.outcome as Record<string, unknown> | undefined
      if (!outcome) continue

      // Timing
      if (trial.timing) {
        totalTokensIn += trial.timing.inputTokens ?? 0
        totalTokensOut += trial.timing.outputTokens ?? 0
      }

      // Dimension scores
      if (!dimensions[result.id]) dimensions[result.id] = { intention: [], static: [], dynamic: [] }
      const dim = dimensions[result.id]!

      const intention = outcome.intention as Record<string, unknown> | undefined
      if (intention?.score !== undefined) dim.intention.push(intention.score as number)

      const staticDim = outcome.static as Record<string, unknown> | undefined
      if (staticDim?.score !== undefined) dim.static.push(staticDim.score as number)

      const dynamic = outcome.dynamic as Record<string, unknown> | undefined
      if (dynamic?.score !== undefined) dim.dynamic.push(dynamic.score as number)

      // Static check failures
      const checks = (staticDim?.checks as StaticCheck[]) ?? []
      for (const check of checks) {
        if (!check.pass) {
          const key = `${check.name}: ${check.error?.slice(0, 80) ?? 'unknown'}`
          staticFailures[key] = (staticFailures[key] ?? 0) + 1
        }
      }

      // Intention item failures
      const intentionResults = (intention?.results as Array<{ item: string; pass: boolean }>) ?? []
      for (const item of intentionResults) {
        if (!item.pass) {
          intentionFailures[item.item.slice(0, 60)] = (intentionFailures[item.item.slice(0, 60)] ?? 0) + 1
        }
      }

      // Dynamic item failures
      const dynamicResults = (dynamic?.results as Array<{ item: string; pass: boolean }>) ?? []
      for (const item of dynamicResults) {
        if (!item.pass) {
          dynamicFailures[item.item.slice(0, 60)] = (dynamicFailures[item.item.slice(0, 60)] ?? 0) + 1
        }
      }
    }
  }

  return {
    byDomain,
    byDifficulty,
    dimensions,
    staticFailures,
    intentionFailures,
    dynamicFailures,
    totalTokensIn,
    totalTokensOut,
  }
}

// ============================================================================
// Reporting
// ============================================================================

const mean = (arr: number[]): number => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length)

const printGroupMetrics = (_label: string, groups: Record<string, TrialResult[]>) => {
  for (const [_group, results] of Object.entries(groups).sort()) {
    const _passes = results.reduce((s, r) => s + r.trials.filter((t) => t.pass).length, 0)
    const _total = results.reduce((s, r) => s + r.trials.length, 0)
    const _avgPassRate = mean(results.map((r) => r.passRate ?? 0))
    const avgPassAtK = mean(results.map((r) => r.passAtK ?? 0))
    const avgPassExpK = mean(results.map((r) => r.passExpK ?? 0))
    const _flakiness = avgPassAtK - avgPassExpK
  }
}

const printPerPrompt = (results: TrialResult[], dimensions: Record<string, DimensionScores>) => {
  for (const r of results.sort((a, b) => (a.passRate ?? 0) - (b.passRate ?? 0))) {
    const meta = r.metadata as Record<string, unknown> | undefined
    const _diff = ((meta?.difficulty as string) ?? '?').slice(0, 4)
    const dim = dimensions[r.id]
    const avgI = dim ? mean(dim.intention) : 0
    const avgS = dim ? mean(dim.static) : 0
    const avgD = dim ? mean(dim.dynamic) : 0
    const _composite = Math.cbrt(avgI * avgS * avgD)
  }
}

const printTopFailures = (_label: string, failures: Record<string, number>, limit = 10) => {
  const sorted = Object.entries(failures)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
  if (sorted.length === 0) return

  for (const [_key, _count] of sorted) {
  }
}

const printSkillGaps = (
  staticFailures: Record<string, number>,
  _intentionFailures: Record<string, number>,
  dynamicFailures: Record<string, number>,
) => {
  // MSS vocabulary gaps
  const mssFailures = Object.entries(staticFailures)
    .filter(([k]) => k.includes('contentType') || k.includes('modnet'))
    .sort((a, b) => b[1] - a[1])
  if (mssFailures.length > 0) {
    console.log('  → Improve mss-vocabulary skill (contentType/modnet field issues)')
    for (const [k, v] of mssFailures) console.log(`    ${k}: ${v} failures`)
  }

  // Parse/type failures → generative-ui or code-patterns
  const codeFailures = Object.entries(staticFailures)
    .filter(([k]) => k.includes('parse') || k.includes('typeCheck'))
    .sort((a, b) => b[1] - a[1])
  if (codeFailures.length > 0) {
    console.log('  → Improve code-patterns or generative-ui skill (parse/type issues)')
    for (const [k, v] of codeFailures) console.log(`    ${k}: ${v} failures`)
  }

  // SKILL.md failures → modnet-node
  const skillMdFailures = Object.entries(staticFailures)
    .filter(([k]) => k.includes('skillMd'))
    .sort((a, b) => b[1] - a[1])
  if (skillMdFailures.length > 0) {
    console.log('  → Improve modnet-node skill (SKILL.md structure issues)')
    for (const [k, v] of skillMdFailures) console.log(`    ${k}: ${v} failures`)
  }

  // Dynamic failures → behavioral-core or generative-ui
  const dynamicTotal = Object.values(dynamicFailures).reduce((s, v) => s + v, 0)
  if (dynamicTotal > 5) {
    console.log('  → Improve behavioral-core or generative-ui skill (dynamic behavior issues)')
    const top = Object.entries(dynamicFailures)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    for (const [k, v] of top) console.log(`    ${k}: ${v} failures`)
  }
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const path = process.argv[2] ?? (await findLatestResults())
  const resolved = resolve(path)
  console.log(`\nAnalyzing: ${resolved}\n`)

  const results = await loadJsonl(resolved)
  console.log(`Loaded ${results.length} prompt results\n`)

  const {
    byDomain,
    byDifficulty,
    dimensions,
    staticFailures,
    intentionFailures,
    dynamicFailures,
    totalTokensIn,
    totalTokensOut,
  } = analyzeResults(results)

  // Overall
  const totalTrials = results.reduce((s, r) => s + r.trials.length, 0)
  const totalPass = results.reduce((s, r) => s + r.trials.filter((t) => t.pass).length, 0)
  const avgPassAtK = mean(results.map((r) => r.passAtK ?? 0))
  const avgPassExpK = mean(results.map((r) => r.passExpK ?? 0))
  console.log('=== Overall ===')
  console.log(`  Trials: ${totalPass}/${totalTrials} pass (${((totalPass / totalTrials) * 100).toFixed(1)}%)`)
  console.log(`  Avg pass@k: ${avgPassAtK.toFixed(3)}`)
  console.log(`  Avg pass^k: ${avgPassExpK.toFixed(3)}`)
  if (totalTokensIn > 0) {
    console.log(`  Tokens: ${totalTokensIn.toLocaleString()} in, ${totalTokensOut.toLocaleString()} out`)
  }

  printGroupMetrics('By Domain', byDomain)
  printGroupMetrics('By Difficulty', byDifficulty)
  printPerPrompt(results, dimensions)
  printTopFailures('Static', staticFailures)
  printTopFailures('Intention', intentionFailures)
  printTopFailures('Dynamic', dynamicFailures)
  printSkillGaps(staticFailures, intentionFailures, dynamicFailures)
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

export { main }
