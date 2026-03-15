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

import { parseCli } from './cli.utils.ts'
import type { Grader, GradingDimensions } from './trial.schemas.ts'
import {
  TrainingScoreInputSchema,
  TrainingScoreOutputSchema,
  type MetaVerification,
  type TrainingScore,
} from './training.schemas.ts'

// ============================================================================
// Training Weight
// ============================================================================

/**
 * Compute training weight from grading dimensions.
 *
 * @remarks
 * Training weight = `outcome × process`. Missing dimensions default to 0,
 * ensuring unscored trajectories contribute nothing to training.
 * See `docs/TRAINING.md` § Augmented Self-Distillation.
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
 * This differs from the verifier-based `withMetaVerification` in
 * `trial.utils.ts` — that version runs a separate verifier function once.
 * This version runs the grader itself k times for statistical analysis.
 *
 * @public
 */
export const withMetaVerification = (grader: Grader, k: number): Grader => {
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
