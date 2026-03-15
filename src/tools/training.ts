/**
 * Training pipeline — scoring functions and CLI handler.
 *
 * @remarks
 * Connects BP snapshots to model improvement via scoring infrastructure.
 * Library functions are primary — `computeTrainingWeight()` and
 * `withMetaVerification()` work in-process. CLI provides JSON in/out
 * for weight computation.
 *
 * Two key functions:
 * - `computeTrainingWeight` — outcome x process scoring per TRAINING.md
 * - `withMetaVerification` — runs a grader k times, computes confidence
 *   interval stats (mean, stddev, min, max) to detect flaky graders
 *
 * @packageDocumentation
 */

import * as z from 'zod'
import { parseCli } from './cli.utils.ts'
import type { GradingDimensions } from './trial.schemas.ts'
import { GradingDimensionsSchema } from './trial.schemas.ts'
import type { Grader, GraderResult } from './trial.schemas.ts'
import type { MetaVerificationStats } from './training.schemas.ts'
import { TrainingWeightResultSchema } from './training.schemas.ts'

// ============================================================================
// computeTrainingWeight
// ============================================================================

/**
 * Compute training weight from grading dimensions.
 *
 * @remarks
 * Training weight = outcome x process. This is the core scoring
 * function for the augmented self-distillation pipeline. Trajectories
 * above group mean get positive GRPO advantage; below get negative.
 *
 * Missing dimensions default to 0 — a trajectory without an outcome
 * score or process score gets zero training weight (conservative).
 *
 * @param dimensions - Multi-dimensional grading scores
 * @returns Training weight between 0 and 1
 *
 * @public
 */
export const computeTrainingWeight = (dimensions: GradingDimensions): number => {
  const outcome = dimensions.outcome ?? 0
  const process = dimensions.process ?? 0
  return outcome * process
}

// ============================================================================
// withMetaVerification (k-runs variant)
// ============================================================================

/**
 * Wrap a grader with k-runs meta-verification for flakiness detection.
 *
 * @remarks
 * Runs the grader k times on the same input and computes statistical
 * confidence intervals on the score distribution. High stddev indicates
 * a flaky grader whose signal should not be trusted for training.
 *
 * This is distinct from the single-verifier `withMetaVerification` in
 * `trial.utils.ts` — that one composes a grader with a separate verifier
 * function. This one tests a grader's own consistency via repetition.
 *
 * The returned grader:
 * - `score`: mean of k runs
 * - `pass`: majority vote (>50% of runs passed)
 * - `outcome._metaVerification`: full statistics
 *
 * @param grader - The grader function to test for consistency
 * @param k - Number of times to run the grader (minimum 1)
 * @returns Wrapped grader that includes meta-verification stats
 *
 * @public
 */
export const withMetaVerification = (grader: Grader, k: number): Grader => {
  return async (params) => {
    const results: GraderResult[] = []
    for (let i = 0; i < k; i++) {
      results.push(await grader(params))
    }

    const scores = results.map((r) => r.score)
    const passes = results.filter((r) => r.pass).length
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length
    const stddev = Math.sqrt(variance)
    const min = Math.min(...scores)
    const max = Math.max(...scores)

    const stats: MetaVerificationStats = { mean, stddev, min, max, k, scores }

    return {
      pass: passes > k / 2,
      score: mean,
      reasoning: `Meta-verification: ${k} runs, mean=${mean.toFixed(4)}, stddev=${stddev.toFixed(4)}, range=[${min.toFixed(4)}, ${max.toFixed(4)}]`,
      outcome: {
        _metaVerification: stats,
      },
    }
  }
}

// ============================================================================
// CLI Schema + Handler
// ============================================================================

/**
 * CLI input schema for the training command.
 *
 * @remarks
 * Accepts grading dimensions and computes the training weight.
 *
 * @public
 */
export const TrainingInputSchema = z.object({
  outcome: z.number().min(0).max(1).describe('Outcome correctness score (0-1)'),
  process: z.number().min(0).max(1).describe('Process quality score (0-1)'),
  efficiency: z.number().min(0).max(1).optional().describe('Efficiency score (not used in weight computation)'),
})

/** CLI output schema */
export const TrainingOutputSchema = TrainingWeightResultSchema

/**
 * CLI handler for the training command.
 *
 * @remarks
 * Computes training weight from provided dimensions.
 * Uses `parseCli` for input parsing, validates with Zod,
 * outputs JSON result to stdout.
 *
 * @public
 */
export const trainingCli = async (args: string[]): Promise<void> => {
  const input = await parseCli(args, TrainingInputSchema, {
    name: 'training',
    outputSchema: TrainingOutputSchema,
  })

  const dimensions: GradingDimensions = {
    outcome: input.outcome,
    process: input.process,
    efficiency: input.efficiency,
  }

  const weight = computeTrainingWeight(dimensions)

  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify({ weight, outcome: input.outcome, process: input.process }))
}
