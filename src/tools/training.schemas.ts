/**
 * Zod schemas and types for the training pipeline.
 *
 * @remarks
 * Schema-first approach — Zod schemas are the single source of truth,
 * TypeScript types derived via `z.infer<>`.
 *
 * Re-exports `GradingDimensionsSchema` (from trial schemas) and
 * `DecisionStepSchema` (from agent schemas) for ergonomic imports
 * by training consumers. Adds training-specific schemas for weight
 * computation and meta-verification statistics.
 *
 * @packageDocumentation
 */

import * as z from 'zod'

// ============================================================================
// Re-exports — canonical schemas used by training consumers
// ============================================================================

export { GradingDimensionsSchema, type GradingDimensions } from './trial.schemas.ts'
export { DecisionStepSchema, type DecisionStep } from '../agent/agent.schemas.ts'

// ============================================================================
// Meta-Verification Statistics
// ============================================================================

/**
 * Statistics from running a grader k times for flakiness detection.
 *
 * @remarks
 * Produced by the k-runs `withMetaVerification` wrapper. Captures
 * the distribution of scores across repeated grader invocations
 * on the same input — high stddev indicates a flaky grader whose
 * signal should not be trusted for training.
 *
 * @public
 */
export const MetaVerificationStatsSchema = z.object({
  /** Mean score across k runs */
  mean: z.number(),
  /** Standard deviation of scores */
  stddev: z.number(),
  /** Minimum score observed */
  min: z.number(),
  /** Maximum score observed */
  max: z.number(),
  /** Number of runs */
  k: z.number(),
  /** Individual scores from each run */
  scores: z.array(z.number()),
})

/** Meta-verification statistics type */
export type MetaVerificationStats = z.infer<typeof MetaVerificationStatsSchema>

// ============================================================================
// Training Weight Result
// ============================================================================

/**
 * Result of computing a training weight from grading dimensions.
 *
 * @remarks
 * Training weight = outcome x process. Captures the input dimensions
 * alongside the computed weight for transparency.
 *
 * @public
 */
export const TrainingWeightResultSchema = z.object({
  /** Computed training weight (outcome x process) */
  weight: z.number().min(0).max(1),
  /** Outcome score used in computation */
  outcome: z.number().min(0).max(1),
  /** Process score used in computation */
  process: z.number().min(0).max(1),
})

/** Training weight result type */
export type TrainingWeightResult = z.infer<typeof TrainingWeightResultSchema>
