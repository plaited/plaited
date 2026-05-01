import { limitTextBytes } from '../worker/limit-text-bytes.ts'
import {
  EVAL_COMMAND_OUTPUTS,
  EVAL_GRADER_TYPES,
  EVAL_GRADER_WHEN,
  EVAL_MODES,
  EVAL_TRIAL_STATUSES,
} from './eval.constants.ts'
import { summarizeEvalTrialProcess } from './eval.process.ts'
import {
  type EvalCommandGrader,
  type EvalGradeInput,
  type EvalGrader,
  type EvalGraderResult,
  type EvalInlineGraderResult,
  EvalInlineGraderResultSchema,
  type EvalProcessGrader,
  type EvalProcessSummary,
  type EvalTrial,
  type EvalTrialResult,
  EvalTrialResultSchema,
} from './eval.schemas.ts'

type GraderExecutionContext = {
  trial: EvalTrial
  process: EvalProcessSummary
  previousResults: EvalGraderResult[]
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
