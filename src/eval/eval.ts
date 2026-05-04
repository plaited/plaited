import { SNAPSHOT_MESSAGE_KINDS, type SnapshotMessage } from '../behavioral.ts'
import { makeCli } from '../cli/cli.ts'
import { limitTextBytes } from '../worker/limit-text-bytes.ts'
import {
  EVAL_CALIBRATE_FOCUSES,
  EVAL_CALIBRATE_REVIEW_LABELS,
  EVAL_CALIBRATE_SNAPSHOT_MODES,
  EVAL_COMMAND_OUTPUTS,
  EVAL_GRADER_TYPES,
  EVAL_GRADER_WHEN,
  EVAL_MODES,
  EVAL_TRIAL_STATUSES,
} from './eval.constants.ts'
import {
  type EvalCalibrateFocus,
  type EvalCalibrateInput,
  EvalCalibrateOutputSchema,
  type EvalCalibrateSampleSource,
  type EvalCalibrateSnapshotMode,
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
  type EvalTrialStatus,
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

type IndexedTrialResult = {
  taskIndex: number
  trialIndex: number
  taskId: string
  trialResult: EvalTrialResult
}

type CalibrateCandidate = IndexedTrialResult & {
  source: EvalCalibrateSampleSource
  focusedGraderResult: EvalGraderResult | null
}

const hashSeed = (text: string): number => {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const createMulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let output = Math.imul(state ^ (state >>> 15), 1 | state)
    output ^= output + Math.imul(output ^ (output >>> 7), 61 | output)
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296
  }
}

const shuffleDeterministic = <ItemType>(items: ItemType[], random: () => number): ItemType[] => {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index] as ItemType
    const swapValue = shuffled[swapIndex] as ItemType
    shuffled[index] = swapValue
    shuffled[swapIndex] = current
  }
  return shuffled
}

const indexBundleTrials = (bundle: EvalRunBundle): IndexedTrialResult[] => {
  const indexed: IndexedTrialResult[] = []

  bundle.tasks.forEach((task, taskIndex) => {
    task.trials.forEach((trialResult, trialIndex) => {
      indexed.push({
        taskIndex,
        trialIndex,
        taskId: task.taskId,
        trialResult,
      })
    })
  })

  return indexed
}

const hasMatchingGraderId = ({ bundle, graderId }: { bundle: EvalRunBundle; graderId: string }): boolean => {
  return bundle.tasks.some((task) =>
    task.trials.some((trialResult) => trialResult.graderResults.some((graderResult) => graderResult.id === graderId)),
  )
}

const findGraderResult = ({
  graderId,
  trialResult,
}: {
  graderId: string
  trialResult: EvalTrialResult
}): EvalGraderResult | null => {
  const graderResult = trialResult.graderResults.find((result) => result.id === graderId)
  return graderResult ?? null
}

const isCompletedStatus = (status: EvalTrialStatus): boolean => status === EVAL_TRIAL_STATUSES.completed

const candidateMatchesFocus = ({
  focus,
  graderId,
  trialResult,
  focusedGraderResult,
}: {
  focus: EvalCalibrateFocus
  graderId: string | null
  trialResult: EvalTrialResult
  focusedGraderResult: EvalGraderResult | null
}): boolean => {
  const completed = isCompletedStatus(trialResult.trial.result.status)

  if (focus === EVAL_CALIBRATE_FOCUSES.required_failures) {
    if (graderId === null) {
      return completed && hasRequiredFailure(trialResult.graderResults)
    }

    if (focusedGraderResult === null || focusedGraderResult.skipped) {
      return false
    }

    return completed && focusedGraderResult.required && focusedGraderResult.pass === false
  }

  if (focus === EVAL_CALIBRATE_FOCUSES.all_failures) {
    if (graderId === null) {
      return trialResult.pass === false
    }

    if (focusedGraderResult === null || focusedGraderResult.skipped) {
      return false
    }

    return focusedGraderResult.pass === false
  }

  if (graderId === null) {
    return completed
  }

  return completed && focusedGraderResult !== null && focusedGraderResult.skipped === false
}

const isCandidatePass = ({
  focus,
  graderId,
  candidate,
}: {
  focus: EvalCalibrateFocus
  graderId: string | null
  candidate: CalibrateCandidate
}): boolean => {
  if (focus === EVAL_CALIBRATE_FOCUSES.all && graderId !== null) {
    return candidate.focusedGraderResult?.pass === true
  }

  return candidate.trialResult.pass
}

const summarizePopulation = ({
  trialResults,
  graderId,
}: {
  trialResults: EvalTrialResult[]
  graderId: string | null
}): Record<string, unknown> => {
  let completedTrialCount = 0
  let nonCompletedTrialCount = 0
  let trialPassCount = 0
  let trialFailCount = 0

  let executedCount = 0
  let skippedCount = 0
  let requiredExecutedCount = 0
  let requiredPassCount = 0
  let requiredFailCount = 0
  let optionalExecutedCount = 0
  let optionalPassCount = 0
  let optionalFailCount = 0

  let focusedExecutedPassCount = 0
  let focusedExecutedFailCount = 0
  let focusedSkippedCount = 0
  let focusedMissingCount = 0

  for (const trialResult of trialResults) {
    if (isCompletedStatus(trialResult.trial.result.status)) {
      completedTrialCount += 1
    } else {
      nonCompletedTrialCount += 1
    }

    if (trialResult.pass) {
      trialPassCount += 1
    } else {
      trialFailCount += 1
    }

    for (const graderResult of trialResult.graderResults) {
      if (graderResult.skipped) {
        skippedCount += 1
        continue
      }

      executedCount += 1

      if (graderResult.required) {
        requiredExecutedCount += 1
        if (graderResult.pass) {
          requiredPassCount += 1
        } else {
          requiredFailCount += 1
        }
      } else {
        optionalExecutedCount += 1
        if (graderResult.pass) {
          optionalPassCount += 1
        } else {
          optionalFailCount += 1
        }
      }
    }

    if (graderId !== null) {
      const focused = findGraderResult({ graderId, trialResult })
      if (focused === null) {
        focusedMissingCount += 1
      } else if (focused.skipped) {
        focusedSkippedCount += 1
      } else if (focused.pass) {
        focusedExecutedPassCount += 1
      } else {
        focusedExecutedFailCount += 1
      }
    }
  }

  return {
    trialCount: trialResults.length,
    completedTrialCount,
    nonCompletedTrialCount,
    trialPassCount,
    trialFailCount,
    graderOutcomes: {
      executedCount,
      skippedCount,
      requiredExecutedCount,
      requiredPassCount,
      requiredFailCount,
      optionalExecutedCount,
      optionalPassCount,
      optionalFailCount,
    },
    focusedGrader:
      graderId === null
        ? null
        : {
            graderId,
            executedPassCount: focusedExecutedPassCount,
            executedFailCount: focusedExecutedFailCount,
            skippedCount: focusedSkippedCount,
            missingCount: focusedMissingCount,
          },
  }
}

const isDiagnosticSnapshot = (snapshot: SnapshotMessage): boolean => {
  if (snapshot.kind === SNAPSHOT_MESSAGE_KINDS.runtime_error) {
    return true
  }

  if (snapshot.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error) {
    return true
  }

  if (snapshot.kind === SNAPSHOT_MESSAGE_KINDS.deadlock) {
    return true
  }

  return isWorkerSnapshotFailure(snapshot)
}

const selectDiagnosticSnapshots = ({
  snapshots,
  maxSnapshotsPerSample,
}: {
  snapshots: SnapshotMessage[]
  maxSnapshotsPerSample: number
}): SnapshotMessage[] => {
  if (snapshots.length <= maxSnapshotsPerSample) {
    return [...snapshots]
  }

  const selected = new Set<number>()
  const orderedSelection: number[] = []
  const addIndex = (index: number): void => {
    if (
      index < 0 ||
      index >= snapshots.length ||
      selected.has(index) ||
      orderedSelection.length >= maxSnapshotsPerSample
    ) {
      return
    }
    selected.add(index)
    orderedSelection.push(index)
  }

  addIndex(0)
  addIndex(1)

  snapshots.forEach((snapshot, index) => {
    if (isDiagnosticSnapshot(snapshot)) {
      addIndex(index)
    }
  })

  addIndex(snapshots.length - 2)
  addIndex(snapshots.length - 1)

  if (orderedSelection.length < maxSnapshotsPerSample) {
    const midpoint = (snapshots.length - 1) / 2
    const midpointIndices = Array.from({ length: snapshots.length }, (_, index) => index)
      .filter((index) => !selected.has(index))
      .sort((left, right) => {
        const leftDistance = Math.abs(left - midpoint)
        const rightDistance = Math.abs(right - midpoint)
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance
        }
        return left - right
      })

    for (const index of midpointIndices) {
      addIndex(index)
      if (orderedSelection.length >= maxSnapshotsPerSample) {
        break
      }
    }
  }

  orderedSelection.sort((left, right) => left - right)
  return orderedSelection.map((index) => snapshots[index] as SnapshotMessage)
}

const selectSnapshotsForSample = ({
  snapshotMode,
  maxSnapshotsPerSample,
  trialResult,
}: {
  snapshotMode: EvalCalibrateSnapshotMode
  maxSnapshotsPerSample: number
  trialResult: EvalTrialResult
}): SnapshotMessage[] => {
  const snapshots = trialResult.trial.snapshots
  if (snapshotMode === EVAL_CALIBRATE_SNAPSHOT_MODES.all) {
    return [...snapshots]
  }

  return selectDiagnosticSnapshots({ snapshots, maxSnapshotsPerSample })
}

const createCandidate = ({
  bundleLabel,
  graderId,
  indexedTrial,
}: {
  bundleLabel: string
  graderId: string | null
  indexedTrial: IndexedTrialResult
}): CalibrateCandidate => {
  const focusedGraderResult =
    graderId === null ? null : findGraderResult({ graderId, trialResult: indexedTrial.trialResult })

  return {
    ...indexedTrial,
    focusedGraderResult,
    source: {
      bundleLabel,
      taskIndex: indexedTrial.taskIndex,
      trialIndex: indexedTrial.trialIndex,
      taskId: indexedTrial.taskId,
      trialId: indexedTrial.trialResult.trial.id,
    },
  }
}

const selectCandidates = ({
  candidates,
  focus,
  graderId,
  requestedSample,
  random,
}: {
  candidates: CalibrateCandidate[]
  focus: EvalCalibrateFocus
  graderId: string | null
  requestedSample: number
  random: () => number
}): CalibrateCandidate[] => {
  const boundedSampleSize = Math.min(requestedSample, candidates.length)
  if (boundedSampleSize === 0) {
    return []
  }

  if (focus !== EVAL_CALIBRATE_FOCUSES.all) {
    return shuffleDeterministic(candidates, random).slice(0, boundedSampleSize)
  }

  const passCandidates = candidates.filter((candidate) => isCandidatePass({ focus, graderId, candidate }))
  const failCandidates = candidates.filter((candidate) => !isCandidatePass({ focus, graderId, candidate }))

  const shuffledPass = shuffleDeterministic(passCandidates, random)
  const shuffledFail = shuffleDeterministic(failCandidates, random)

  const targetFailCount = Math.ceil(boundedSampleSize / 2)
  const targetPassCount = Math.floor(boundedSampleSize / 2)

  const selected: CalibrateCandidate[] = []
  let passCursor = 0
  let failCursor = 0

  const initialFailCount = Math.min(targetFailCount, shuffledFail.length)
  const initialPassCount = Math.min(targetPassCount, shuffledPass.length)

  for (let index = 0; index < initialFailCount; index += 1) {
    selected.push(shuffledFail[failCursor] as CalibrateCandidate)
    failCursor += 1
  }

  for (let index = 0; index < initialPassCount; index += 1) {
    selected.push(shuffledPass[passCursor] as CalibrateCandidate)
    passCursor += 1
  }

  while (selected.length < boundedSampleSize) {
    const remainingFail = shuffledFail.length - failCursor
    const remainingPass = shuffledPass.length - passCursor

    if (remainingFail <= 0 && remainingPass <= 0) {
      break
    }

    if (remainingFail >= remainingPass && remainingFail > 0) {
      selected.push(shuffledFail[failCursor] as CalibrateCandidate)
      failCursor += 1
      continue
    }

    if (remainingPass > 0) {
      selected.push(shuffledPass[passCursor] as CalibrateCandidate)
      passCursor += 1
      continue
    }

    selected.push(shuffledFail[failCursor] as CalibrateCandidate)
    failCursor += 1
  }

  return shuffleDeterministic(selected, random)
}

const buildResolvedSeed = ({
  inputSeed,
  bundleLabel,
  focus,
  graderId,
  sample,
  snapshotMode,
  maxSnapshotsPerSample,
}: {
  inputSeed: string | number | undefined
  bundleLabel: string
  focus: EvalCalibrateFocus
  graderId: string | null
  sample: number
  snapshotMode: EvalCalibrateSnapshotMode
  maxSnapshotsPerSample: number
}): string => {
  if (inputSeed !== undefined) {
    return String(inputSeed)
  }

  return [bundleLabel, focus, graderId ?? '*', String(sample), snapshotMode, String(maxSnapshotsPerSample)].join('|')
}

const calibrateEvalRun = (input: EvalCalibrateInput): EvalCliOutput => {
  const graderId = input.graderId ?? null
  if (graderId !== null && !hasMatchingGraderId({ bundle: input.bundle, graderId })) {
    throw new Error(
      `Unknown graderId '${graderId}': no matching grader result found in bundle '${input.bundle.label}'.`,
    )
  }

  const resolvedSeed = buildResolvedSeed({
    inputSeed: input.seed,
    bundleLabel: input.bundle.label,
    focus: input.focus,
    graderId,
    sample: input.sample,
    snapshotMode: input.snapshotMode,
    maxSnapshotsPerSample: input.maxSnapshotsPerSample,
  })
  const random = createMulberry32(hashSeed(resolvedSeed))

  const indexedTrials = indexBundleTrials(input.bundle)
  const allCandidates = indexedTrials.map((indexedTrial) =>
    createCandidate({
      bundleLabel: input.bundle.label,
      graderId,
      indexedTrial,
    }),
  )

  const filteredCandidates = allCandidates.filter((candidate) =>
    candidateMatchesFocus({
      focus: input.focus,
      graderId,
      trialResult: candidate.trialResult,
      focusedGraderResult: candidate.focusedGraderResult,
    }),
  )

  const selectedCandidates = selectCandidates({
    candidates: filteredCandidates,
    focus: input.focus,
    graderId,
    requestedSample: input.sample,
    random,
  })

  const warnings: string[] = []
  if (input.snapshotMode === EVAL_CALIBRATE_SNAPSHOT_MODES.all) {
    warnings.push('snapshotMode=all may produce large output because full trial snapshots are included.')
  }
  if (filteredCandidates.length < input.sample) {
    warnings.push(
      `Requested sample size ${input.sample} exceeds candidate pool ${filteredCandidates.length}; returning all candidates.`,
    )
  }

  const samples = selectedCandidates.map((candidate) => {
    const trial = candidate.trialResult.trial
    const { snapshots: _snapshots, ...trialWithoutSnapshots } = trial
    const failedGraders = candidate.trialResult.graderResults.filter(
      (graderResult) => !graderResult.skipped && graderResult.pass === false,
    )
    const failedRequiredGraders = failedGraders.filter((graderResult) => graderResult.required)

    return {
      source: candidate.source,
      trial: trialWithoutSnapshots,
      process: candidate.trialResult.process,
      graderResults: candidate.trialResult.graderResults,
      focusedGraderResult: candidate.focusedGraderResult,
      failedGraders,
      failedRequiredGraders,
      snapshots: selectSnapshotsForSample({
        snapshotMode: input.snapshotMode,
        maxSnapshotsPerSample: input.maxSnapshotsPerSample,
        trialResult: candidate.trialResult,
      }),
    }
  })

  const candidatePassCount = filteredCandidates.filter((candidate) =>
    isCandidatePass({ focus: input.focus, graderId, candidate }),
  ).length
  const sampledPassCount = selectedCandidates.filter((candidate) =>
    isCandidatePass({ focus: input.focus, graderId, candidate }),
  ).length

  const reviewProtocol = {
    labels: [
      EVAL_CALIBRATE_REVIEW_LABELS.correct_accept,
      EVAL_CALIBRATE_REVIEW_LABELS.incorrect_accept,
      EVAL_CALIBRATE_REVIEW_LABELS.correct_reject,
      EVAL_CALIBRATE_REVIEW_LABELS.incorrect_reject,
      EVAL_CALIBRATE_REVIEW_LABELS.ambiguous,
      EVAL_CALIBRATE_REVIEW_LABELS.needs_human,
    ],
    confidenceThreshold: 0.75,
    guidance: [
      'Assess whether grader outcomes match observed evidence in the sampled trial.',
      'Use needs_human when task intent, policy constraints, or evidence sufficiency is unclear.',
      'Use ambiguous only for a final unresolved adjudication after review.',
    ],
    escalationRules: [
      'Escalate to a human when confidence is below the threshold.',
      'Escalate to a human when correctness depends on product intent not visible in trial evidence.',
      'Escalate to a human when available snapshots and grader outcomes are insufficient to decide.',
    ],
  }

  return EvalCalibrateOutputSchema.parse({
    mode: EVAL_MODES.calibrate,
    focus: input.focus,
    sample: input.sample,
    graderId,
    snapshotMode: input.snapshotMode,
    maxSnapshotsPerSample: input.maxSnapshotsPerSample,
    resolvedSeed,
    warnings,
    reviewProtocol,
    reviewResponseContract: {
      type: 'object',
      required: ['label', 'confidence', 'reasoning'],
      properties: {
        label: {
          type: 'string',
          enum: reviewProtocol.labels,
          description: 'Final reviewer adjudication label.',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Reviewer confidence in [0, 1].',
        },
        reasoning: {
          type: 'string',
          minLength: 1,
          description: 'Concise evidence-grounded rationale for the adjudication.',
        },
        needsHumanReason: {
          type: 'string',
          minLength: 1,
          description: 'Required when label is needs_human.',
        },
      },
      constraints: [
        "When label is 'needs_human', include needsHumanReason.",
        "When label is 'ambiguous', do not use it as a temporary workflow state.",
      ],
    },
    bundleSummary: summarizePopulation({
      trialResults: allCandidates.map((candidate) => candidate.trialResult),
      graderId,
    }),
    candidateSummary: {
      focus: input.focus,
      candidateCount: filteredCandidates.length,
      candidatePassCount,
      candidateFailCount: filteredCandidates.length - candidatePassCount,
      population: summarizePopulation({
        trialResults: filteredCandidates.map((candidate) => candidate.trialResult),
        graderId,
      }),
    },
    sampleSummary: {
      requestedSample: input.sample,
      actualSample: selectedCandidates.length,
      sampledPassCount,
      sampledFailCount: selectedCandidates.length - sampledPassCount,
      population: summarizePopulation({
        trialResults: selectedCandidates.map((candidate) => candidate.trialResult),
        graderId,
      }),
    },
    samples,
  })
}

const runEval = async (input: EvalCliInput): Promise<EvalCliOutput> => {
  if (input.mode === EVAL_MODES.grade) {
    return gradeEvalTrial(input)
  }

  if (input.mode === EVAL_MODES.calibrate) {
    return calibrateEvalRun(input)
  }

  return compareEvalRuns(input)
}

export const evalCli = makeCli({
  name: 'eval',
  inputSchema: EvalCliInputSchema,
  outputSchema: EvalCliOutputSchema,
  run: runEval,
})
