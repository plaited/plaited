import { EVAL_MODES } from './eval.constants.ts'
import {
  type EvalCompareInput,
  type EvalComparisonMetrics,
  EvalComparisonMetricsSchema,
  type EvalComparisonWinner,
  type EvalRunBundle,
  type EvalRunComparison,
  EvalRunComparisonSchema,
  type EvalTrialResult,
} from './eval.schemas.ts'

const mean = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

const validateTaskTrialIds = (bundle: EvalRunBundle): void => {
  for (const task of bundle.tasks) {
    for (const trialResult of task.trials) {
      if (trialResult.trial.task.id !== task.taskId) {
        throw new Error(
          `Invalid compare bundle '${bundle.label}' task '${task.taskId}': trial.task.id '${trialResult.trial.task.id}' does not match taskId.`,
        )
      }
    }
  }
}

const buildMetrics = ({ trials, k }: { trials: EvalTrialResult[]; k?: number }): EvalComparisonMetrics => {
  const trialCount = trials.length
  const passCount = trials.filter((trial) => trial.pass).length
  const passRate = trialCount === 0 ? 0 : passCount / trialCount
  const avgScore = trialCount === 0 ? 0 : mean(trials.map((trial) => trial.score))

  if (k === undefined) {
    return EvalComparisonMetricsSchema.parse({
      trialCount,
      passCount,
      passRate,
      avgScore,
    })
  }

  const estimatedPassAtK = trialCount >= k ? 1 - (1 - passRate) ** k : null
  const estimatedPassAllK = trialCount >= k ? passRate ** k : null

  return EvalComparisonMetricsSchema.parse({
    trialCount,
    passCount,
    passRate,
    avgScore,
    estimatedPassAtK,
    estimatedPassAllK,
  })
}

const flattenTrials = (bundle: EvalRunBundle): EvalTrialResult[] => {
  return bundle.tasks.flatMap((task) => task.trials)
}

const indexTrialsByTaskId = (bundle: EvalRunBundle): Map<string, EvalTrialResult[]> => {
  const index = new Map<string, EvalTrialResult[]>()

  for (const task of bundle.tasks) {
    const existing = index.get(task.taskId)
    if (existing === undefined) {
      index.set(task.taskId, [...task.trials])
      continue
    }
    existing.push(...task.trials)
  }

  return index
}

const resolveWinner = ({
  baseline,
  challenger,
  comparable,
}: {
  baseline: EvalComparisonMetrics | null
  challenger: EvalComparisonMetrics | null
  comparable: boolean
}): EvalComparisonWinner => {
  if (!comparable || baseline === null || challenger === null) {
    return 'insufficient_data'
  }

  if (baseline.passRate > challenger.passRate) {
    return 'baseline'
  }

  if (challenger.passRate > baseline.passRate) {
    return 'challenger'
  }

  if (baseline.avgScore > challenger.avgScore) {
    return 'baseline'
  }

  if (challenger.avgScore > baseline.avgScore) {
    return 'challenger'
  }

  return 'tie'
}

export const compareEvalRuns = ({ baseline, challenger, k }: EvalCompareInput): EvalRunComparison => {
  validateTaskTrialIds(baseline)
  validateTaskTrialIds(challenger)

  const baselineByTask = indexTrialsByTaskId(baseline)
  const challengerByTask = indexTrialsByTaskId(challenger)
  const taskIds = [...new Set([...baselineByTask.keys(), ...challengerByTask.keys()])].sort((a, b) =>
    a.localeCompare(b),
  )

  let baselineWins = 0
  let challengerWins = 0
  let ties = 0
  let insufficientData = 0
  let comparableTasks = 0

  const perTask = taskIds.map((taskId) => {
    const baselineTrials = baselineByTask.get(taskId) ?? []
    const challengerTrials = challengerByTask.get(taskId) ?? []

    const baselineMetrics = baselineTrials.length > 0 ? buildMetrics({ trials: baselineTrials, k }) : null
    const challengerMetrics = challengerTrials.length > 0 ? buildMetrics({ trials: challengerTrials, k }) : null
    const comparable = baselineTrials.length > 0 && challengerTrials.length > 0
    const winner = resolveWinner({ baseline: baselineMetrics, challenger: challengerMetrics, comparable })

    if (comparable) {
      comparableTasks += 1
    }

    if (winner === 'baseline') {
      baselineWins += 1
    } else if (winner === 'challenger') {
      challengerWins += 1
    } else if (winner === 'tie') {
      ties += 1
    } else {
      insufficientData += 1
    }

    return {
      taskId,
      baselineTrialCount: baselineTrials.length,
      challengerTrialCount: challengerTrials.length,
      comparable,
      baseline: baselineMetrics,
      challenger: challengerMetrics,
      winner,
    }
  })

  const baselineTrials = flattenTrials(baseline)
  const challengerTrials = flattenTrials(challenger)

  return EvalRunComparisonSchema.parse({
    mode: EVAL_MODES.compare,
    baseline: {
      label: baseline.label,
      metrics: buildMetrics({ trials: baselineTrials, k }),
    },
    challenger: {
      label: challenger.label,
      metrics: buildMetrics({ trials: challengerTrials, k }),
    },
    perTask,
    summary: {
      baselineWins,
      challengerWins,
      ties,
      insufficientData,
      comparableTasks,
      totalTasks: taskIds.length,
    },
  })
}
