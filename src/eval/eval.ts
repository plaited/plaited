import { SNAPSHOT_MESSAGE_KINDS, type SnapshotMessage } from '../behavioral.ts'
import { makeCli } from '../cli/cli.ts'
import { limitTextBytes } from '../worker/limit-text-bytes.ts'
import {
  EVAL_COMMAND_OUTPUTS,
  EVAL_GRADER_TYPES,
  EVAL_GRADER_WHEN,
  EVAL_MODES,
  EVAL_TRIAL_STATUSES,
} from './eval.constants.ts'
import {
  type EvalCliInput,
  EvalCliInputSchema,
  type EvalCliOutput,
  EvalCliOutputSchema,
  type EvalCommandGrader,
  type EvalCompareInput,
  type EvalComparisonMetrics,
  EvalComparisonMetricsSchema,
  type EvalComparisonWinner,
  type EvalGradeInput,
  type EvalGrader,
  type EvalGraderResult,
  type EvalInlineGraderResult,
  EvalInlineGraderResultSchema,
  type EvalProcessGrader,
  type EvalProcessSummary,
  EvalProcessSummarySchema,
  type EvalRunBundle,
  type EvalRunComparison,
  EvalRunComparisonSchema,
  type EvalTrial,
  type EvalTrialResult,
  EvalTrialResultSchema,
} from './eval.schemas.ts'

type GraderExecutionContext = {
  trial: EvalTrial
  process: EvalProcessSummary
  previousResults: EvalGraderResult[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

export const isWorkerSnapshotFailure = (snapshot: SnapshotMessage): boolean => {
  if (snapshot.kind !== SNAPSHOT_MESSAGE_KINDS.worker) {
    return false
  }

  if (!isRecord(snapshot.response)) {
    return false
  }

  const exitCode = snapshot.response.exitCode
  if (typeof exitCode === 'number' && exitCode !== 0) {
    return true
  }

  const timedOut = snapshot.response.timedOut
  if (timedOut === true) {
    return true
  }

  const signalCode = snapshot.response.signalCode
  if (signalCode !== null && signalCode !== undefined) {
    return true
  }

  return false
}

const countSnapshotsByKind = (snapshots: SnapshotMessage[], kind: SnapshotMessage['kind']): number =>
  snapshots.filter((snapshot) => snapshot.kind === kind).length

const countRepeatedSelections = (
  selectedTypes: string[],
): { repeatedSelectionCount: number; maxRepeatedSelectionTypeCount: number } => {
  if (selectedTypes.length === 0) {
    return {
      repeatedSelectionCount: 0,
      maxRepeatedSelectionTypeCount: 0,
    }
  }

  let repeatedSelectionCount = 0
  let maxRepeatedSelectionTypeCount = 0
  let currentRun = 0
  let previousType: string | undefined

  for (const selectedType of selectedTypes) {
    if (selectedType === previousType) {
      currentRun += 1
      repeatedSelectionCount += 1
    } else {
      currentRun = 1
      previousType = selectedType
    }

    if (currentRun > maxRepeatedSelectionTypeCount) {
      maxRepeatedSelectionTypeCount = currentRun
    }
  }

  return {
    repeatedSelectionCount,
    maxRepeatedSelectionTypeCount,
  }
}

export const summarizeEvalTrialProcess = (trial: EvalTrial): EvalProcessSummary => {
  const snapshots = trial.snapshots
  const selectedTypes = snapshots
    .filter((snapshot): snapshot is Extract<SnapshotMessage, { kind: 'selection' }> => {
      return snapshot.kind === SNAPSHOT_MESSAGE_KINDS.selection
    })
    .map((snapshot) => snapshot.selected.type)

  const runtimeErrorCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.runtime_error)
  const feedbackErrorCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.feedback_error)
  const deadlockCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.deadlock)
  const selectionCount = countSnapshotsByKind(snapshots, SNAPSHOT_MESSAGE_KINDS.selection)
  const workerFailureCount = snapshots.filter(isWorkerSnapshotFailure).length
  const { repeatedSelectionCount, maxRepeatedSelectionTypeCount } = countRepeatedSelections(selectedTypes)

  return EvalProcessSummarySchema.parse({
    snapshotCount: snapshots.length,
    selectionCount,
    runtimeErrorCount,
    feedbackErrorCount,
    deadlockCount,
    workerFailureCount,
    repeatedSelectionCount,
    maxRepeatedSelectionTypeCount,
    runtimeErrorDetected: runtimeErrorCount > 0 || workerFailureCount > 0,
    feedbackErrorDetected: feedbackErrorCount > 0,
    deadlockDetected: deadlockCount > 0,
    workerFailureDetected: workerFailureCount > 0,
  })
}

const isCompletedTrial = (trial: EvalTrial): boolean => trial.result.status === EVAL_TRIAL_STATUSES.completed

const shouldSkipGrader = ({ grader, trial }: { grader: EvalGrader; trial: EvalTrial }): boolean => {
  if (grader.when === EVAL_GRADER_WHEN.always) {
    return false
  }

  if (grader.when === EVAL_GRADER_WHEN.completed) {
    return !isCompletedTrial(trial)
  }

  return false
}

const createSkippedGraderResult = ({ grader, reason }: { grader: EvalGrader; reason: string }): EvalGraderResult => ({
  id: grader.id,
  type: grader.type,
  required: grader.required,
  weight: grader.weight,
  when: grader.when,
  metadata: grader.metadata,
  skipped: true,
  pass: null,
  score: null,
  reasoning: reason,
})

const createExecutedGraderResult = ({
  grader,
  result,
}: {
  grader: EvalGrader
  result: EvalInlineGraderResult & { outcome?: Record<string, unknown> }
}): EvalGraderResult => ({
  id: grader.id,
  type: grader.type,
  required: grader.required,
  weight: grader.weight,
  when: grader.when,
  metadata: grader.metadata,
  skipped: false,
  pass: result.pass,
  score: result.score,
  reasoning: result.reasoning,
  outcome: result.outcome,
})

const evaluateProcessGrader = ({
  grader,
  process,
}: {
  grader: EvalProcessGrader
  process: EvalProcessSummary
}): EvalGraderResult => {
  const options = grader.options ?? {}
  const failures: string[] = []

  if ((options.failOnRuntimeError ?? true) && process.runtimeErrorDetected) {
    failures.push('runtime errors detected')
  }
  if ((options.failOnFeedbackError ?? true) && process.feedbackErrorDetected) {
    failures.push('feedback errors detected')
  }
  if ((options.failOnDeadlock ?? true) && process.deadlockDetected) {
    failures.push('deadlocks detected')
  }
  if ((options.failOnWorkerFailure ?? true) && process.workerFailureDetected) {
    failures.push('worker failures detected')
  }
  if (options.maxSelections !== undefined && process.selectionCount > options.maxSelections) {
    failures.push(`selectionCount ${process.selectionCount} exceeds maxSelections ${options.maxSelections}`)
  }
  if (
    options.maxRepeatedSelectionType !== undefined &&
    process.maxRepeatedSelectionTypeCount > options.maxRepeatedSelectionType
  ) {
    failures.push(
      `maxRepeatedSelectionTypeCount ${process.maxRepeatedSelectionTypeCount} exceeds maxRepeatedSelectionType ${options.maxRepeatedSelectionType}`,
    )
  }

  const pass = failures.length === 0

  return createExecutedGraderResult({
    grader,
    result: {
      pass,
      score: pass ? 1 : 0,
      reasoning: pass ? 'Process checks passed.' : failures.join('; '),
      outcome: {
        checks: failures,
        process,
      },
    },
  })
}

const resolveSignalCode = (proc: Bun.Subprocess): string | number | null => {
  const signalCode = (proc as unknown as { signalCode?: string | number | null }).signalCode
  return signalCode ?? null
}

const runCommandGrader = async ({
  grader,
  trial,
  previousResults,
}: {
  grader: EvalCommandGrader
  trial: EvalTrial
  previousResults: EvalGraderResult[]
}): Promise<EvalGraderResult> => {
  const startedAt = Date.now()
  const maxOutputBytes = grader.options.maxOutputBytes ?? 256_000
  const stdoutBudget = Math.floor(maxOutputBytes / 2)
  const stderrBudget = maxOutputBytes - stdoutBudget
  const createCommandOutcome = ({
    durationMs,
    exitCode,
    signalCode,
    stderrRaw,
    stdoutRaw,
    timedOut,
  }: {
    durationMs: number
    exitCode: number | null
    signalCode: string | number | null
    stderrRaw: string
    stdoutRaw: string
    timedOut: boolean
  }): Record<string, unknown> => {
    const stdoutResult = limitTextBytes(stdoutRaw, stdoutBudget)
    const stderrResult = limitTextBytes(stderrRaw, stderrBudget)

    return {
      command: grader.options.command,
      cwd: trial.cwd,
      exitCode,
      signalCode,
      timedOut,
      durationMs,
      stdout: stdoutResult.text,
      stderr: stderrResult.text,
      stdoutBytes: stdoutResult.originalBytes,
      stderrBytes: stderrResult.originalBytes,
      stdoutTruncated: stdoutResult.truncated,
      stderrTruncated: stderrResult.truncated,
    }
  }

  const controller = new AbortController()
  let timedOut = false
  const timeoutHandle =
    grader.options.timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
          timedOut = true
          controller.abort()
        }, grader.options.timeoutMs)

  const invocation = JSON.stringify({
    trial,
    grader,
    previousResults,
  })

  let proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'>
  let stdoutRaw = ''
  let stderrRaw = ''
  let exitCode: number | null = null
  let signalCode: string | number | null = null

  try {
    proc = Bun.spawn(grader.options.command, {
      cwd: trial.cwd,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      signal: controller.signal,
    })
    proc.stdin.write(invocation)
    proc.stdin.end()

    ;[stdoutRaw, stderrRaw, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    signalCode = resolveSignalCode(proc)
  } catch (error) {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle)
    }

    const message = error instanceof Error ? error.message : String(error)
    const commandOutcome = createCommandOutcome({
      durationMs: Date.now() - startedAt,
      exitCode,
      signalCode,
      stderrRaw,
      stdoutRaw,
      timedOut,
    })

    return createExecutedGraderResult({
      grader,
      result: {
        pass: false,
        score: 0,
        reasoning: `Command failed to execute: ${message}`,
        outcome: {
          ...commandOutcome,
          error: message,
        },
      },
    })
  }

  if (timeoutHandle !== undefined) {
    clearTimeout(timeoutHandle)
  }

  const commandOutcome = createCommandOutcome({
    durationMs: Date.now() - startedAt,
    exitCode,
    signalCode,
    stderrRaw,
    stdoutRaw,
    timedOut,
  })

  if ((grader.options.output ?? EVAL_COMMAND_OUTPUTS.exit_code) === EVAL_COMMAND_OUTPUTS.exit_code) {
    const pass = exitCode === 0
    return createExecutedGraderResult({
      grader,
      result: {
        pass,
        score: pass ? 1 : 0,
        reasoning: pass ? 'Command exited with code 0.' : `Command exited with code ${exitCode}.`,
        outcome: commandOutcome,
      },
    })
  }

  if (exitCode !== 0) {
    return createExecutedGraderResult({
      grader,
      result: {
        pass: false,
        score: 0,
        reasoning: `Command exited with code ${exitCode}; expected 0 for grader_json output.`,
        outcome: commandOutcome,
      },
    })
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(stdoutRaw)
  } catch {
    return createExecutedGraderResult({
      grader,
      result: {
        pass: false,
        score: 0,
        reasoning: 'stdout was not valid JSON for grader_json output.',
        outcome: commandOutcome,
      },
    })
  }

  const normalizedResult = EvalInlineGraderResultSchema.safeParse(parsedJson)
  if (!normalizedResult.success) {
    return createExecutedGraderResult({
      grader,
      result: {
        pass: false,
        score: 0,
        reasoning: 'stdout JSON did not match normalized grader result schema.',
        outcome: {
          ...commandOutcome,
          schemaIssues: normalizedResult.error.issues,
        },
      },
    })
  }

  return createExecutedGraderResult({
    grader,
    result: {
      ...normalizedResult.data,
      outcome: {
        command: commandOutcome,
        grader: normalizedResult.data.outcome,
      },
    },
  })
}

const runJsonGrader = ({ grader }: { grader: Extract<EvalGrader, { type: 'json' }> }): EvalGraderResult => {
  return createExecutedGraderResult({
    grader,
    result: grader.result,
  })
}

const executeGrader = async ({
  grader,
  trial,
  process,
  previousResults,
}: {
  grader: EvalGrader
} & GraderExecutionContext): Promise<EvalGraderResult> => {
  if (shouldSkipGrader({ grader, trial })) {
    return createSkippedGraderResult({
      grader,
      reason: `Skipped because when='${grader.when}' and trial status='${trial.result.status}'.`,
    })
  }

  if (grader.type === EVAL_GRADER_TYPES.process) {
    return evaluateProcessGrader({ grader, process })
  }

  if (grader.type === EVAL_GRADER_TYPES.command) {
    return runCommandGrader({ grader, trial, previousResults })
  }

  return runJsonGrader({ grader })
}

const computeWeightedScore = (graderResults: EvalGraderResult[]): number => {
  const scoredGraders = graderResults.filter((graderResult) => !graderResult.skipped && graderResult.score !== null)
  if (scoredGraders.length === 0) {
    return 0
  }

  const totalWeight = scoredGraders.reduce((sum, graderResult) => sum + graderResult.weight, 0)
  if (totalWeight <= 0) {
    return 0
  }

  const weightedScore = scoredGraders.reduce((sum, graderResult) => {
    return sum + (graderResult.score ?? 0) * graderResult.weight
  }, 0)

  return weightedScore / totalWeight
}

const hasRequiredFailure = (graderResults: EvalGraderResult[]): boolean => {
  return graderResults.some((graderResult) => {
    if (graderResult.skipped) {
      return false
    }

    if (!graderResult.required) {
      return false
    }

    return graderResult.pass !== true
  })
}

const buildReasoning = ({
  trial,
  requiredFailure,
}: {
  trial: EvalTrial
  requiredFailure: boolean
}): string | undefined => {
  if (!isCompletedTrial(trial)) {
    return `Trial status '${trial.result.status}' forces overall pass=false and score=0.`
  }

  if (requiredFailure) {
    return 'At least one non-skipped required grader failed.'
  }

  return undefined
}

export const gradeEvalTrial = async ({ trial, graders }: EvalGradeInput): Promise<EvalTrialResult> => {
  const process = summarizeEvalTrialProcess(trial)
  const graderResults: EvalGraderResult[] = []

  for (const grader of graders) {
    const result = await executeGrader({
      grader,
      trial,
      process,
      previousResults: graderResults,
    })
    graderResults.push(result)
  }

  const requiredFailure = hasRequiredFailure(graderResults)
  const pass = isCompletedTrial(trial) && !requiredFailure
  const score = isCompletedTrial(trial) ? computeWeightedScore(graderResults) : 0
  const reasoning = buildReasoning({ trial, requiredFailure })

  return EvalTrialResultSchema.parse({
    mode: EVAL_MODES.grade,
    trial,
    process,
    graderResults,
    pass,
    score,
    reasoning,
  })
}

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

const runEval = async (input: EvalCliInput): Promise<EvalCliOutput> => {
  if (input.mode === EVAL_MODES.grade) {
    return gradeEvalTrial(input)
  }

  return compareEvalRuns(input)
}

export const evalCli = makeCli({
  name: 'eval',
  inputSchema: EvalCliInputSchema,
  outputSchema: EvalCliOutputSchema,
  run: runEval,
})
