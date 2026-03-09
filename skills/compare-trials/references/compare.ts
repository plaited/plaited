/**
 * Reference comparison script for TrialResult JSONL files.
 *
 * @remarks
 * Takes two JSONL file paths as arguments, computes aggregate and
 * per-prompt metrics, runs bootstrap resampling for confidence intervals,
 * and outputs a structured JSON comparison report.
 *
 * Usage: bun run compare.ts baseline.jsonl challenger.jsonl
 */

import { bootstrap, mean, median } from './bootstrap.ts'

// ============================================================================
// Types (inline — this is a standalone script)
// ============================================================================

type TrialEntry = {
  trialNum: number
  output: string
  duration: number
  pass?: boolean
  score?: number
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

type RunMetrics = {
  label: string
  promptCount: number
  avgPassRate: number
  avgPassAtK: number
  avgPassExpK: number
  avgFlakiness: number
  avgDuration: number
  medianDuration: number
  passRateCI: [number, number]
  passAtKCI: [number, number]
}

type PerPromptComparison = {
  id: string
  baselinePassRate: number | null
  challengerPassRate: number | null
  baselinePassAtK: number | null
  challengerPassAtK: number | null
  winner: string | null
}

type ComparisonReport = {
  baseline: RunMetrics
  challenger: RunMetrics
  perPrompt: PerPromptComparison[]
  summary: {
    baselineWins: number
    challengerWins: number
    ties: number
    totalPrompts: number
  }
}

// ============================================================================
// Loading
// ============================================================================

const loadJsonl = async (path: string): Promise<TrialResult[]> => {
  const content = await Bun.file(path).text()
  return content
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrialResult)
}

const indexById = (results: TrialResult[]): Map<string, TrialResult> => {
  const map = new Map<string, TrialResult>()
  for (const r of results) map.set(r.id, r)
  return map
}

// ============================================================================
// Metrics Computation
// ============================================================================

const computeRunMetrics = (label: string, results: TrialResult[]): RunMetrics => {
  const passRates = results.map((r) => r.passRate ?? 0)
  const passAtKs = results.map((r) => r.passAtK ?? 0)
  const passExpKs = results.map((r) => r.passExpK ?? 0)
  const flakiness = results.map((r) => (r.passAtK ?? 0) - (r.passExpK ?? 0))
  const durations = results.flatMap((r) => r.trials.map((t) => t.duration))

  return {
    label,
    promptCount: results.length,
    avgPassRate: mean(passRates),
    avgPassAtK: mean(passAtKs),
    avgPassExpK: mean(passExpKs),
    avgFlakiness: mean(flakiness),
    avgDuration: mean(durations),
    medianDuration: median(durations),
    passRateCI: bootstrap(passRates),
    passAtKCI: bootstrap(passAtKs),
  }
}

// ============================================================================
// Comparison
// ============================================================================

const compare = (baseline: TrialResult[], challenger: TrialResult[]): ComparisonReport => {
  const baselineIndex = indexById(baseline)
  const challengerIndex = indexById(challenger)

  // Get all unique prompt IDs
  const allIds = new Set([...baselineIndex.keys(), ...challengerIndex.keys()])

  const perPrompt: PerPromptComparison[] = []
  let baselineWins = 0
  let challengerWins = 0
  let ties = 0

  for (const id of allIds) {
    const b = baselineIndex.get(id)
    const c = challengerIndex.get(id)

    const bPassAtK = b?.passAtK ?? null
    const cPassAtK = c?.passAtK ?? null

    let winner: string | null = null
    if (bPassAtK !== null && cPassAtK !== null) {
      if (bPassAtK > cPassAtK) {
        winner = 'baseline'
        baselineWins++
      } else if (cPassAtK > bPassAtK) {
        winner = 'challenger'
        challengerWins++
      } else {
        ties++
      }
    }

    perPrompt.push({
      id,
      baselinePassRate: b?.passRate ?? null,
      challengerPassRate: c?.passRate ?? null,
      baselinePassAtK: bPassAtK,
      challengerPassAtK: cPassAtK,
      winner,
    })
  }

  return {
    baseline: computeRunMetrics('baseline', baseline),
    challenger: computeRunMetrics('challenger', challenger),
    perPrompt,
    summary: {
      baselineWins,
      challengerWins,
      ties,
      totalPrompts: allIds.size,
    },
  }
}

// ============================================================================
// Main
// ============================================================================

const main = async () => {
  const [baselinePath, challengerPath] = process.argv.slice(2)

  if (!baselinePath || !challengerPath) {
    console.error('Usage: bun run compare.ts <baseline.jsonl> <challenger.jsonl>')
    process.exit(1)
  }

  const baseline = await loadJsonl(baselinePath)
  const challenger = await loadJsonl(challengerPath)

  const report = compare(baseline, challenger)

  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify(report, null, 2))
}

await main()
