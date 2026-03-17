/**
 * Training pipeline schemas and types.
 *
 * @remarks
 * Connects BP snapshots to model improvement. Re-exports canonical schemas
 * from agent and trial modules; adds training-specific scoring schemas.
 *
 * `DecisionStepSchema` imported from `src/agent/agent.schemas.ts` (canonical source).
 * `GradingDimensionsSchema` imported from `src/improve/trial.schemas.ts` (canonical source).
 *
 * @packageDocumentation
 */

import * as z from 'zod'
import { GradingDimensionsSchema } from './trial.schemas.ts'

export { type DecisionStep, DecisionStepSchema } from '../agent/agent.schemas.ts'
export { type GradingDimensions, GradingDimensionsSchema } from './trial.schemas.ts'

// ============================================================================
// Training Score
// ============================================================================

/**
 * Training score — grading dimensions with computed overall weight.
 *
 * @remarks
 * Extends `GradingDimensions` with `overall`, computed as `outcome × process`.
 * Trajectories with correct outcomes but poor reasoning (retry loops,
 * unnecessary tool calls) get lower weights than clean solutions.
 * See `skills/training-pipeline/` § Augmented Self-Distillation.
 *
 * @public
 */
export const TrainingScoreSchema = GradingDimensionsSchema.extend({
  /** Computed training weight: outcome × process */
  overall: z.number().min(0).max(1),
})

/** Training score type */
export type TrainingScore = z.infer<typeof TrainingScoreSchema>

// ============================================================================
// Meta-Verification
// ============================================================================

/**
 * Statistical meta-verification result from running a grader k times.
 *
 * @remarks
 * Detects flaky graders by computing confidence intervals over repeated
 * runs. A high `stddev` indicates inconsistent scoring — the grader's
 * signal should not be trusted for training data.
 *
 * Stored in `outcome._metaVerification` on the `GraderResult`.
 *
 * @public
 */
export const MetaVerificationSchema = z.object({
  /** Mean score across k runs */
  mean: z.number().min(0).max(1),
  /** Standard deviation of scores */
  stddev: z.number().min(0),
  /** Minimum score observed */
  min: z.number().min(0).max(1),
  /** Maximum score observed */
  max: z.number().min(0).max(1),
  /** Number of grader runs */
  k: z.number().int().positive(),
  /** Individual scores from each run */
  scores: z.array(z.number().min(0).max(1)),
})

/** Meta-verification result type */
export type MetaVerification = z.infer<typeof MetaVerificationSchema>

// ============================================================================
// CLI Schemas
// ============================================================================

/**
 * CLI input schema for the training-score command.
 *
 * @public
 */
export const TrainingScoreInputSchema = z.object({
  outcome: z.number().min(0).max(1).optional().describe('Outcome correctness score (0-1)'),
  process: z.number().min(0).max(1).optional().describe('Process quality score (0-1)'),
  efficiency: z.number().min(0).max(1).optional().describe('Efficiency score (0-1)'),
})

/** CLI input type */
export type TrainingScoreInput = z.infer<typeof TrainingScoreInputSchema>

/** CLI output schema (array of TrainingScore) */
export const TrainingScoreOutputSchema = TrainingScoreSchema
