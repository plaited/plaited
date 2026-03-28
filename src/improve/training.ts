/**
 * Training pipeline — scoring functions and CLI handler.
 *
 * @remarks
 * Connects BP snapshots to model improvement via training weights.
 * Training weight = outcome × process — trajectories with correct outcomes
 * but poor reasoning get lower weights than clean solutions.
 *
 * Library API is primary. CLI resolves input, then delegates to library.
 *
 * @packageDocumentation
 */

import { parseCli } from '../tools/cli.utils.ts'
import {
  type MetaVerification,
  type TrainingCandidateAssessment,
  type TrainingCaptureAssessment,
  type TrainingScore,
  TrainingScoreInputSchema,
  TrainingScoreOutputSchema,
} from './training.schemas.ts'
import type {
  CaptureEvidence,
  Grader,
  GradingDimensions,
  TrajectoryRichness,
  TrialEntry,
  TrialResult,
} from './trial.schemas.ts'
import { detectRichness, hasToolErrors } from './trial.utils.ts'

// ============================================================================
// Training Weight
// ============================================================================

/**
 * Compute training weight from grading dimensions.
 *
 * @remarks
 * Training weight = `outcome × process`. Missing dimensions default to 0,
 * ensuring unscored trajectories contribute nothing to training.
 * See `dev-research/evolutionary-agent/program.md` and `docs/TRAINING.md`.
 *
 * @public
 */
export const computeTrainingWeight = (dimensions: GradingDimensions): number => {
  const outcome = dimensions.outcome ?? 0
  const process = dimensions.process ?? 0
  return outcome * process
}

/**
 * Score grading dimensions into a training score with computed overall weight.
 *
 * @remarks
 * Convenience wrapper — spreads existing dimensions and adds the
 * computed `overall` field.
 *
 * @public
 */
export const scoreTrainingDimensions = (dimensions: GradingDimensions): TrainingScore => ({
  ...dimensions,
  overall: computeTrainingWeight(dimensions),
})

// ============================================================================
// Training Candidate Assessment
// ============================================================================

const TRAINING_RICHNESS_ORDER: Record<TrajectoryRichness, number> = {
  minimal: 0,
  'messages-only': 1,
  full: 2,
}

/** Configuration for training-candidate assessment. */
export type AssessTrainingCandidateOptions = {
  trial: Pick<TrialEntry, 'capture' | 'trajectory' | 'timedOut' | 'exitCode' | 'pass'>
  dimensions?: GradingDimensions
  minWeight?: number
  minRichness?: Exclude<TrajectoryRichness, 'minimal'>
  requirePass?: boolean
  requireDimensions?: boolean
  allowToolErrors?: boolean
}

/** Configuration for runtime-only trace capture assessment. */
export type AssessTrainingCaptureOptions = {
  trial: Pick<TrialEntry, 'capture' | 'trajectory' | 'timedOut' | 'exitCode'>
  minRichness?: Exclude<TrajectoryRichness, 'minimal'>
  allowToolErrors?: boolean
}

/**
 * Extracted training candidate from a graded trial result.
 *
 * @public
 */
export type TrainingDataCandidate = {
  id: string
  input: string | string[]
  output: string
  trialNum: number
  trajectory: NonNullable<TrialEntry['trajectory']>
  capture?: CaptureEvidence
  assessment: TrainingCandidateAssessment
  dimensions?: GradingDimensions
  outcome?: TrialEntry['outcome']
  metadata?: TrialResult['metadata']
}

/**
 * Assess whether a trial should be kept for distillation/training.
 *
 * @remarks
 * This is the policy seam between evals and model improvement. It converts
 * runtime facts plus grader dimensions into a typed eligibility decision so
 * downstream training code does not need to infer policy from raw trial data.
 *
 * @public
 */
export const assessTrainingCandidate = ({
  trial,
  dimensions,
  minWeight = 0.2,
  minRichness = 'full',
  requirePass = true,
  requireDimensions = true,
  allowToolErrors = false,
}: AssessTrainingCandidateOptions): TrainingCandidateAssessment => {
  const reasons = new Set<TrainingCandidateAssessment['reasons'][number]>()
  const trajectory = trial.trajectory ?? []
  const richness = detectRichness(trajectory, trial.capture)
  const score = dimensions ? scoreTrainingDimensions(dimensions) : undefined
  const weight = score?.overall ?? 0

  if (requireDimensions && !dimensions) reasons.add('missing_dimensions')
  if (requirePass && trial.pass === false) reasons.add('failed_grade')
  if (trial.timedOut) reasons.add('timed_out')
  if (trial.exitCode !== undefined && trial.exitCode !== null && trial.exitCode !== 0) reasons.add('non_zero_exit')
  if (TRAINING_RICHNESS_ORDER[richness] < TRAINING_RICHNESS_ORDER[minRichness]) reasons.add('insufficient_richness')
  if (!allowToolErrors && hasToolErrors(trajectory)) reasons.add('tool_error')
  if (score && weight < minWeight) reasons.add('low_weight')

  return {
    eligible: reasons.size === 0,
    richness,
    ...(score && { score }),
    weight,
    reasons: [...reasons],
  }
}

/**
 * Assess whether a runtime trace is worth keeping for later grading/training.
 *
 * @remarks
 * This is intentionally weaker than `assessTrainingCandidate`. It answers a
 * simpler question for bounded improvement loops: did this run produce a clean,
 * sufficiently rich trace worth saving for later review or grading?
 *
 * @public
 */
export const assessTrainingCapture = ({
  trial,
  minRichness = 'full',
  allowToolErrors = false,
}: AssessTrainingCaptureOptions): TrainingCaptureAssessment => {
  const reasons = new Set<TrainingCaptureAssessment['reasons'][number]>()
  const trajectory = trial.trajectory ?? []
  const richness = detectRichness(trajectory, trial.capture)

  if (trial.timedOut) reasons.add('timed_out')
  if (trial.exitCode !== undefined && trial.exitCode !== null && trial.exitCode !== 0) reasons.add('non_zero_exit')
  if (TRAINING_RICHNESS_ORDER[richness] < TRAINING_RICHNESS_ORDER[minRichness]) reasons.add('insufficient_richness')
  if (!allowToolErrors && hasToolErrors(trajectory)) reasons.add('tool_error')

  return {
    eligible: reasons.size === 0,
    richness,
    reasons: [...reasons],
  }
}

/**
 * Collect training-ready trajectories from trial results.
 *
 * @remarks
 * This is the selection boundary between trial execution and dataset writing.
 * Only trials already marked `trainingAssessment.eligible === true` are kept,
 * and trajectories are required so downstream code receives concrete data
 * instead of having to re-check nullable fields.
 *
 * @public
 */
export const collectTrainingCandidates = (results: TrialResult[]): TrainingDataCandidate[] =>
  results.flatMap((result) =>
    result.trials.flatMap((trial) => {
      if (!trial.trainingAssessment?.eligible) return []
      if (!trial.trajectory) return []

      return [
        {
          id: result.id,
          input: result.input,
          output: trial.output,
          trialNum: trial.trialNum,
          trajectory: trial.trajectory,
          ...(trial.capture && { capture: trial.capture }),
          assessment: trial.trainingAssessment,
          ...(trial.dimensions && { dimensions: trial.dimensions }),
          ...(trial.outcome && { outcome: trial.outcome }),
          ...(result.metadata && { metadata: result.metadata }),
        },
      ]
    }),
  )

// ============================================================================
// Statistical Meta-Verification
// ============================================================================

/**
 * Wrap a grader with statistical meta-verification.
 *
 * @remarks
 * Runs the grader `k` times on the same input and computes a confidence
 * interval (mean, stddev, min, max) over the scores. High stddev indicates
 * a flaky grader whose signal should not be trusted for training.
 *
 * The aggregated result uses majority vote for pass/fail and mean for score.
 * Meta-verification data is stored in `outcome._metaVerification`.
 *
 * This differs from the verifier-based `withStatisticalVerification` in
 * `trial.utils.ts` — that version runs a separate verifier function once.
 * This version runs the grader itself k times for statistical analysis.
 *
 * @public
 */
export const withStatisticalVerification = (grader: Grader, k: number): Grader => {
  return async (params) => {
    const results = await Promise.all(Array.from({ length: k }, () => grader(params)))

    const scores = results.map((r) => r.score)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length
    const stddev = Math.sqrt(variance)
    const min = Math.min(...scores)
    const max = Math.max(...scores)

    // Majority vote for pass/fail
    const passes = results.filter((r) => r.pass).length
    const pass = passes > k / 2

    const base = results[0]!

    const metaVerification: MetaVerification = { mean, stddev, min, max, k, scores }

    return {
      pass,
      score: mean,
      reasoning: base.reasoning,
      dimensions: base.dimensions,
      outcome: {
        ...base.outcome,
        _metaVerification: metaVerification,
      },
    }
  }
}

// ============================================================================
// CLI Handler
// ============================================================================

/**
 * CLI handler for the training-score command.
 *
 * @remarks
 * Accepts `GradingDimensions` (outcome, process, efficiency — all optional)
 * and returns `TrainingScore` with computed `overall` weight.
 *
 * @public
 */
export const trainingScoreCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, TrainingScoreInputSchema, {
    name: 'training-score',
    outputSchema: TrainingScoreOutputSchema,
  })

  const result = scoreTrainingDimensions(input)
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify(result))
}
