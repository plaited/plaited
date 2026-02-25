/**
 * Built-in weighted comparison grader for trials data.
 *
 * @remarks
 * Configurable weights for capability (passAtK), reliability (passExpK),
 * and consistency (1 - flakiness) dimensions.
 *
 * Weights can be customized via environment variables:
 * - `COMPARE_CAPABILITY` (default: 0.4)
 * - `COMPARE_RELIABILITY` (default: 0.4)
 * - `COMPARE_CONSISTENCY` (default: 0.2)
 *
 * @packageDocumentation
 */

import type {
  ComparisonGraderResult,
  TrialsComparisonGrader,
  TrialsComparisonGraderInput,
} from '../pipeline/pipeline.types.ts'

/**
 * Weight configuration for trials comparison dimensions.
 */
export type TrialsWeights = {
  /** Weight for capability (passAtK) - can the agent solve this at least once? */
  capability: number
  /** Weight for reliability (passExpK) - does the agent solve this consistently? */
  reliability: number
  /** Weight for consistency (1 - flakiness) - low gap between capability and reliability */
  consistency: number
}

/** Default weights: capability=0.4, reliability=0.4, consistency=0.2 */
export const DEFAULT_TRIALS_WEIGHTS: TrialsWeights = {
  capability: 0.4,
  reliability: 0.4,
  consistency: 0.2,
}

/**
 * Read weights from environment variables with fallback to defaults.
 *
 * @remarks
 * Validates that weights are non-negative. Invalid or negative values
 * fall back to defaults.
 *
 * @returns TrialsWeights configuration
 *
 * @public
 */
export const getTrialsWeightsFromEnv = (): TrialsWeights => {
  const parseWeight = (envVar: string | undefined, defaultValue: number): number => {
    if (!envVar) return defaultValue
    const parsed = Number.parseFloat(envVar)
    // Must be a valid non-negative number
    if (Number.isNaN(parsed) || parsed < 0) return defaultValue
    return parsed
  }

  return {
    capability: parseWeight(process.env.COMPARE_CAPABILITY, DEFAULT_TRIALS_WEIGHTS.capability),
    reliability: parseWeight(process.env.COMPARE_RELIABILITY, DEFAULT_TRIALS_WEIGHTS.reliability),
    consistency: parseWeight(process.env.COMPARE_CONSISTENCY, DEFAULT_TRIALS_WEIGHTS.consistency),
  }
}

/**
 * Create a weighted trials comparison grader with custom weights.
 *
 * @param weights - Weight configuration for comparison dimensions
 * @returns Trials comparison grader function
 *
 * @public
 */
export const createTrialsWeightedGrader = (weights: TrialsWeights = DEFAULT_TRIALS_WEIGHTS): TrialsComparisonGrader => {
  return async ({ runs }: TrialsComparisonGraderInput): Promise<ComparisonGraderResult> => {
    const scores = Object.entries(runs).map(([label, run]) => {
      // Capability score: passAtK (0-1)
      const capabilityScore = run.passAtK ?? 0

      // Reliability score: passExpK (0-1)
      const reliabilityScore = run.passExpK ?? 0

      // Consistency score: 1 - flakiness
      // Flakiness = passAtK - passExpK (how much gap between capability and reliability)
      const flakiness = Math.max(0, capabilityScore - reliabilityScore)
      const consistencyScore = 1 - flakiness

      // Weighted combination
      const weighted =
        capabilityScore * weights.capability +
        reliabilityScore * weights.reliability +
        consistencyScore * weights.consistency

      return { label, weighted, capabilityScore, reliabilityScore, consistencyScore, flakiness }
    })

    // Sort by weighted score descending (highest = best)
    const sorted = scores.sort((a, b) => b.weighted - a.weighted)

    return {
      rankings: sorted.map((s, i) => ({
        run: s.label,
        rank: i + 1,
        score: s.weighted,
      })),
      reasoning: `Weighted trials: capability=${weights.capability}, reliability=${weights.reliability}, consistency=${weights.consistency}`,
    }
  }
}

/**
 * Default weighted trials comparison grader using environment or default weights.
 *
 * @remarks
 * This is the default grader used when `--strategy weighted` is specified
 * for trials format comparison.
 *
 * @public
 */
export const grade: TrialsComparisonGrader = async (
  input: TrialsComparisonGraderInput,
): Promise<ComparisonGraderResult> => {
  const weights = getTrialsWeightsFromEnv()
  const grader = createTrialsWeightedGrader(weights)
  return grader(input)
}
