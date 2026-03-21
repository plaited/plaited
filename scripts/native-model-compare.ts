import { loadJsonl, summarizeTrialResults, type TrialResult } from '../src/improve.ts'
import { compareSummaries } from './native-model-bootstrap-cycle.ts'

type SummaryLike = {
  passRate: number
  eligibleRate: number
  averageScore: number
  passedTrials: number
  failedTrials: number
  eligibleTrials: number
  ineligibleTrials: number
}

type PartialSummaryLike = Partial<SummaryLike>

type CompareArgs = {
  baselinePath: string
  candidatePath: string
}

const HELP_TEXT = `Usage: bun scripts/native-model-compare.ts --baseline <summary|results|run-dir> --candidate <summary|results|run-dir>

Accepts:
  - a summary.json path
  - a results.jsonl path
  - a run directory containing either summary.json or results.jsonl
`

const resolveArtifactPath = async (path: string): Promise<string> => {
  const file = Bun.file(path)
  if (await file.exists()) {
    return path
  }

  const summaryPath = `${path.replace(/\/$/, '')}/summary.json`
  if (await Bun.file(summaryPath).exists()) {
    return summaryPath
  }

  const resultsPath = `${path.replace(/\/$/, '')}/results.jsonl`
  if (await Bun.file(resultsPath).exists()) {
    return resultsPath
  }

  throw new Error(`No summary.json or results.jsonl found for ${path}`)
}

const loadSummaryLike = async (path: string): Promise<SummaryLike> => {
  const artifactPath = await resolveArtifactPath(path)

  const normalize = (summary: PartialSummaryLike): SummaryLike => ({
    passRate: summary.passRate ?? 0,
    eligibleRate: summary.eligibleRate ?? 0,
    averageScore: summary.averageScore ?? 0,
    passedTrials: summary.passedTrials ?? 0,
    failedTrials: summary.failedTrials ?? 0,
    eligibleTrials: summary.eligibleTrials ?? 0,
    ineligibleTrials: summary.ineligibleTrials ?? 0,
  })

  if (artifactPath.endsWith('summary.json')) {
    return normalize((await Bun.file(artifactPath).json()) as PartialSummaryLike)
  }

  const results = (await loadJsonl(artifactPath)) as TrialResult[]
  return normalize(summarizeTrialResults(results))
}

const parseArgs = (args: string[]): CompareArgs => {
  let baselinePath = ''
  let candidatePath = ''

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') {
      console.log(HELP_TEXT)
      process.exit(0)
    }

    if (arg === '--baseline') {
      baselinePath = args[index + 1] ?? baselinePath
      index += 1
      continue
    }

    if (arg === '--candidate') {
      candidatePath = args[index + 1] ?? candidatePath
      index += 1
    }
  }

  if (!baselinePath || !candidatePath) {
    throw new Error('Both --baseline and --candidate are required')
  }

  return {
    baselinePath,
    candidatePath,
  }
}

const run = async () => {
  const args = parseArgs(Bun.argv.slice(2))
  const baseline = await loadSummaryLike(args.baselinePath)
  const candidate = await loadSummaryLike(args.candidatePath)
  const comparison = compareSummaries({
    baseline,
    tuned: candidate,
  })

  console.log(`# Native-Model Summary Comparison`)
  console.log()
  console.log(`- Baseline pass rate: ${comparison.baseline.passRate.toFixed(3)}`)
  console.log(`- Candidate pass rate: ${comparison.tuned.passRate.toFixed(3)}`)
  console.log(`- Pass rate delta: ${comparison.delta.passRate.toFixed(3)}`)
  console.log(`- Baseline eligible rate: ${comparison.baseline.eligibleRate.toFixed(3)}`)
  console.log(`- Candidate eligible rate: ${comparison.tuned.eligibleRate.toFixed(3)}`)
  console.log(`- Eligible rate delta: ${comparison.delta.eligibleRate.toFixed(3)}`)
  console.log(`- Baseline avg score: ${comparison.baseline.averageScore.toFixed(3)}`)
  console.log(`- Candidate avg score: ${comparison.tuned.averageScore.toFixed(3)}`)
  console.log(`- Avg score delta: ${comparison.delta.averageScore.toFixed(3)}`)
  console.log(`- No regression: ${comparison.noRegression}`)
  console.log(`- Improved: ${comparison.improved}`)
  console.log(`- Promotion candidate: ${comparison.shouldPromote}`)
}

await run()
