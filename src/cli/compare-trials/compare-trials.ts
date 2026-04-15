import type { TrialResult } from '../eval/eval.schemas.ts'
import { loadJsonl } from '../eval/eval.utils.ts'
import { makeCli } from '../utils/cli.ts'
import {
  type CompareTrialsInput,
  CompareTrialsInputSchema,
  CompareTrialsOutputSchema,
} from './compare-trials.schemas.ts'
import { bootstrap, mean, median } from './compare-trials.utils.ts'

const indexById = (results: TrialResult[]): Map<string, TrialResult> => {
  const resultMap = new Map<string, TrialResult>()
  for (const result of results) {
    resultMap.set(result.id, result)
  }
  return resultMap
}

const computeRunMetrics = ({
  confidence,
  label,
  resamples,
  results,
}: {
  confidence: number
  label: string
  resamples: number
  results: TrialResult[]
}) => {
  const passRates = results.map((result) => result.passRate ?? 0)
  const passAtKs = results.map((result) => result.passAtK ?? 0)
  const passExpKs = results.map((result) => result.passExpK ?? 0)
  const flakiness = results.map((result) => (result.passAtK ?? 0) - (result.passExpK ?? 0))
  const durations = results.flatMap((result) => result.trials.map((trial) => trial.duration))

  return {
    label,
    promptCount: results.length,
    avgPassRate: mean(passRates),
    avgPassAtK: mean(passAtKs),
    avgPassExpK: mean(passExpKs),
    avgFlakiness: mean(flakiness),
    avgDuration: mean(durations),
    medianDuration: median(durations),
    passRateCI: bootstrap(passRates, mean, { resamples, confidence }),
    passAtKCI: bootstrap(passAtKs, mean, { resamples, confidence }),
  }
}

/**
 * Compare two TrialResult JSONL runs and compute aggregate plus per-prompt deltas.
 *
 * @public
 */
export const compareTrials = async ({
  baselineLabel = 'baseline',
  baselinePath,
  challengerLabel = 'challenger',
  challengerPath,
  confidence = 0.95,
  resamples = 1000,
}: CompareTrialsInput) => {
  const baseline = await loadJsonl<TrialResult>(baselinePath)
  const challenger = await loadJsonl<TrialResult>(challengerPath)

  const baselineIndex = indexById(baseline)
  const challengerIndex = indexById(challenger)
  const allIds = new Set([...baselineIndex.keys(), ...challengerIndex.keys()])

  const perPrompt = []
  let baselineWins = 0
  let challengerWins = 0
  let ties = 0

  for (const id of allIds) {
    const baselineResult = baselineIndex.get(id)
    const challengerResult = challengerIndex.get(id)
    const baselinePassAtK = baselineResult?.passAtK ?? null
    const challengerPassAtK = challengerResult?.passAtK ?? null

    let winner: string | null = null
    if (baselinePassAtK !== null && challengerPassAtK !== null) {
      if (baselinePassAtK > challengerPassAtK) {
        winner = baselineLabel
        baselineWins += 1
      } else if (challengerPassAtK > baselinePassAtK) {
        winner = challengerLabel
        challengerWins += 1
      } else {
        ties += 1
      }
    }

    perPrompt.push({
      id,
      baselinePassRate: baselineResult?.passRate ?? null,
      challengerPassRate: challengerResult?.passRate ?? null,
      baselinePassAtK,
      challengerPassAtK,
      winner,
    })
  }

  return {
    baseline: computeRunMetrics({
      label: baselineLabel,
      results: baseline,
      resamples,
      confidence,
    }),
    challenger: computeRunMetrics({
      label: challengerLabel,
      results: challenger,
      resamples,
      confidence,
    }),
    perPrompt,
    summary: {
      baselineWins,
      challengerWins,
      ties,
      totalPrompts: allIds.size,
    },
  }
}

/**
 * CLI handler for the compare-trials command.
 *
 * @public
 */
export const compareTrialsCli = makeCli({
  name: 'compare-trials',
  inputSchema: CompareTrialsInputSchema,
  outputSchema: CompareTrialsOutputSchema,
  run: compareTrials,
})
