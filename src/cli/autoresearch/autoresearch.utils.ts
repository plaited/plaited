import { join, resolve } from 'node:path'
import type { TrialResult } from '../eval/eval.schemas.ts'
import { loadJsonl } from '../eval/eval.utils.ts'
import type {
  AutoresearchBudget,
  AutoresearchPromotion,
  AutoresearchTargetRef,
  CandidateProposal,
} from './autoresearch.types.ts'

const timestamp = (): string => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

/** @public */
export const buildAutoresearchRunId = (target: AutoresearchTargetRef): string =>
  `${target.kind}-${target.id}-${timestamp()}`

/** @public */
export const resolveAutoresearchOutputDir = ({ outputDir, runId }: { outputDir?: string; runId: string }): string =>
  resolve(outputDir ?? join(process.cwd(), '.plaited', 'autoresearch', 'runs', runId))

/** @public */
export const normalizeAutoresearchBudget = (budget?: AutoresearchBudget): Required<AutoresearchBudget> => ({
  maxCandidates: budget?.maxCandidates ?? 3,
  maxAttemptsPerCandidate: budget?.maxAttemptsPerCandidate ?? 1,
  concurrency: budget?.concurrency ?? 1,
})

/** @public */
export const normalizeAutoresearchPromotion = (promotion?: AutoresearchPromotion): Required<AutoresearchPromotion> => ({
  mode: promotion?.mode ?? 'none',
})

/** @public */
export const summarizeTrialResults = (
  results: TrialResult[],
): {
  passRate?: number
  passAtK?: number
  passExpK?: number
} => {
  if (results.length === 0) {
    return {}
  }

  const passRates = results.map((result) => result.passRate).filter((value) => value !== undefined)
  const passAtKs = results.map((result) => result.passAtK).filter((value) => value !== undefined)
  const passExpKs = results.map((result) => result.passExpK).filter((value) => value !== undefined)

  const average = (values: number[]): number | undefined =>
    values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined

  return {
    passRate: average(passRates),
    passAtK: average(passAtKs),
    passExpK: average(passExpKs),
  }
}

/** @public */
export const loadBaselineResults = async (baselineResultsPath?: string): Promise<TrialResult[] | undefined> => {
  if (!baselineResultsPath) {
    return undefined
  }

  return loadJsonl<TrialResult>(baselineResultsPath)
}

/** @public */
export const writeAutoresearchArtifacts = async ({
  outputDir,
  run,
  baselineResults,
  observations,
  candidates,
  promotion,
}: {
  outputDir: string
  run: {
    runId: string
    target: AutoresearchTargetRef
    baselineSummary: {
      passRate?: number
      passAtK?: number
      passExpK?: number
    }
  }
  baselineResults: TrialResult[]
  observations: string[]
  candidates: Array<
    CandidateProposal & {
      validation: 'passed' | 'failed'
      delta?: {
        passRate?: number
        passAtK?: number
        passExpK?: number
      }
    }
  >
  promotion: {
    decision: 'accepted' | 'rejected' | 'deferred'
    candidateId?: string
    reasoning: string
  }
}): Promise<void> => {
  await Bun.write(join(outputDir, 'run.json'), JSON.stringify(run, null, 2))
  await Bun.write(join(outputDir, 'baseline.jsonl'), baselineResults.map((row) => JSON.stringify(row)).join('\n'))
  await Bun.write(
    join(outputDir, 'observations.jsonl'),
    observations.map((row) => JSON.stringify({ text: row })).join('\n'),
  )
  await Bun.write(join(outputDir, 'candidates.jsonl'), candidates.map((row) => JSON.stringify(row)).join('\n'))
  await Bun.write(join(outputDir, 'promotion.json'), JSON.stringify(promotion, null, 2))
}
