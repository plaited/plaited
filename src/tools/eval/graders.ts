/**
 * Built-in comparison graders for the agent eval harness.
 *
 * @remarks
 * Provides built-in strategies for comparing multiple runs:
 *
 * **For CaptureResult (single-run) data:**
 * - **weighted**: Configurable weights for quality, latency, reliability
 * - **statistical**: Bootstrap sampling for confidence intervals
 *
 * **For TrialResult (multi-run reliability) data:**
 * - **trialsWeighted**: Configurable weights for capability, reliability, consistency
 * - **trialsStatistical**: Bootstrap sampling for passAtK confidence intervals
 *
 * @packageDocumentation
 */

// CaptureResult graders
export { createStatisticalGrader, grade as statisticalGrade } from './graders/compare-statistical.ts'
export {
  createWeightedGrader,
  DEFAULT_WEIGHTS,
  getWeightsFromEnv,
  grade as weightedGrade,
  type Weights,
} from './graders/compare-weighted.ts'

// TrialResult graders
export {
  createTrialsStatisticalGrader,
  grade as trialsStatisticalGrade,
} from './graders/trials-compare-statistical.ts'
export {
  createTrialsWeightedGrader,
  DEFAULT_TRIALS_WEIGHTS,
  getTrialsWeightsFromEnv,
  grade as trialsWeightedGrade,
  type TrialsWeights,
} from './graders/trials-compare-weighted.ts'
