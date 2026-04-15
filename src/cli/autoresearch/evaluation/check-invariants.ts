import type { SnapshotMessage } from '../../../behavioral/behavioral.schemas.ts'
import type { AutoresearchEvaluation } from '../autoresearch.types.ts'
import type { ModuleScenarioResult } from './run-module-scenarios.ts'

const flattenSnapshots = (scenarios: ModuleScenarioResult[]): SnapshotMessage[] =>
  scenarios.flatMap((scenario) => scenario.snapshots)

/**
 * Converts scenario and invariant results into a single autoresearch evaluation
 * summary.
 *
 * @public
 */
export const evaluateModuleScenarios = ({
  scenarios,
}: {
  scenarios: ModuleScenarioResult[]
}): AutoresearchEvaluation & {
  invariants: ModuleScenarioResult['invariants']
  scenarioPassRate: number
  invariantPassRate: number
  snapshots: SnapshotMessage[]
} => {
  const snapshots = flattenSnapshots(scenarios)
  const allInvariants = scenarios.flatMap((scenario) => scenario.invariants)
  const passedScenarioCount = scenarios.filter((scenario) => scenario.pass).length
  const passedInvariantCount = allInvariants.filter((invariant) => invariant.pass).length
  const scenarioPassRate = scenarios.length > 0 ? passedScenarioCount / scenarios.length : 0
  const invariantPassRate = allInvariants.length > 0 ? passedInvariantCount / allInvariants.length : 0
  const pass = scenarios.every((scenario) => scenario.pass)

  return {
    pass,
    summary: pass
      ? `Module scenario suite passed ${passedScenarioCount}/${scenarios.length} scenarios with invariantPassRate=${invariantPassRate.toFixed(2)}.`
      : `Module scenario suite failed: ${passedScenarioCount}/${scenarios.length} scenarios passed and invariantPassRate=${invariantPassRate.toFixed(2)}.`,
    score: scenarioPassRate * 0.7 + invariantPassRate * 0.3,
    metrics: {
      scenarioPassRate,
      invariantPassRate,
      snapshotCount: snapshots.length,
    },
    invariants: allInvariants,
    scenarioPassRate,
    invariantPassRate,
    snapshots,
  }
}
