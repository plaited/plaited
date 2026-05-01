import { describe, expect, test } from 'bun:test'

import { compareEvalRuns } from '../eval.comparison.ts'
import { EvalCompareInputSchema, EvalTrialResultSchema } from '../eval.schemas.ts'

const makeTrialResult = ({
  trialId,
  taskId,
  pass,
  score,
}: {
  trialId: string
  taskId: string
  pass: boolean
  score: number
}) => {
  return EvalTrialResultSchema.parse({
    mode: 'grade',
    trial: {
      id: trialId,
      cwd: '/tmp',
      task: {
        id: taskId,
        prompt: `prompt ${taskId}`,
      },
      result: {
        status: 'completed',
        message: pass ? 'success' : 'failure',
      },
      snapshots: [],
    },
    process: {
      snapshotCount: 0,
      selectionCount: 0,
      runtimeErrorCount: 0,
      feedbackErrorCount: 0,
      deadlockCount: 0,
      workerFailureCount: 0,
      repeatedSelectionCount: 0,
      maxRepeatedSelectionTypeCount: 0,
      runtimeErrorDetected: false,
      feedbackErrorDetected: false,
      deadlockDetected: false,
      workerFailureDetected: false,
    },
    graderResults: [],
    pass,
    score,
  })
}

describe('compareEvalRuns', () => {
  test('compares baseline/challenger bundles with per-task rows and summary counts', () => {
    const input = EvalCompareInputSchema.parse({
      mode: 'compare',
      k: 2,
      baseline: {
        label: 'baseline',
        tasks: [
          {
            taskId: 'task-a',
            trials: [
              makeTrialResult({ trialId: 'ba-1', taskId: 'task-a', pass: true, score: 0.9 }),
              makeTrialResult({ trialId: 'ba-2', taskId: 'task-a', pass: false, score: 0.2 }),
            ],
          },
          {
            taskId: 'task-b',
            trials: [makeTrialResult({ trialId: 'bb-1', taskId: 'task-b', pass: false, score: 0.1 })],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        tasks: [
          {
            taskId: 'task-a',
            trials: [makeTrialResult({ trialId: 'ca-1', taskId: 'task-a', pass: true, score: 0.95 })],
          },
          {
            taskId: 'task-c',
            trials: [makeTrialResult({ trialId: 'cc-1', taskId: 'task-c', pass: true, score: 0.8 })],
          },
        ],
      },
    })

    const output = compareEvalRuns(input)

    expect(output.mode).toBe('compare')
    expect(output.summary.totalTasks).toBe(3)
    expect(output.summary.comparableTasks).toBe(1)
    expect(output.summary.insufficientData).toBe(2)

    const taskA = output.perTask.find((row) => row.taskId === 'task-a')
    expect(taskA).toBeDefined()
    expect(taskA?.baselineTrialCount).toBe(2)
    expect(taskA?.challengerTrialCount).toBe(1)
    expect(taskA?.comparable).toBe(true)
    expect(taskA?.winner).toBe('challenger')

    expect(output.baseline.metrics.estimatedPassAtK).toBeDefined()
    expect(output.baseline.metrics.estimatedPassAllK).toBeDefined()
    expect(output.challenger.metrics.estimatedPassAtK).toBeDefined()
    expect(output.challenger.metrics.estimatedPassAllK).toBeDefined()
  })

  test('throws when taskId does not match trials[].trial.task.id', () => {
    const input = EvalCompareInputSchema.parse({
      mode: 'compare',
      baseline: {
        label: 'baseline',
        tasks: [
          {
            taskId: 'task-x',
            trials: [makeTrialResult({ trialId: 'bx-1', taskId: 'task-y', pass: true, score: 1 })],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        tasks: [],
      },
    })

    expect(() => compareEvalRuns(input)).toThrow('does not match taskId')
  })

  test('uses pass rate before average score when selecting task winners', () => {
    const input = EvalCompareInputSchema.parse({
      mode: 'compare',
      baseline: {
        label: 'baseline',
        tasks: [
          {
            taskId: 'task-score-tie-break',
            trials: [
              makeTrialResult({ trialId: 'b-1', taskId: 'task-score-tie-break', pass: true, score: 0.6 }),
              makeTrialResult({ trialId: 'b-2', taskId: 'task-score-tie-break', pass: true, score: 0.6 }),
            ],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        tasks: [
          {
            taskId: 'task-score-tie-break',
            trials: [
              makeTrialResult({ trialId: 'c-1', taskId: 'task-score-tie-break', pass: true, score: 1 }),
              makeTrialResult({ trialId: 'c-2', taskId: 'task-score-tie-break', pass: false, score: 1 }),
            ],
          },
        ],
      },
    })

    const output = compareEvalRuns(input)

    expect(output.perTask[0]?.winner).toBe('baseline')
    expect(output.summary.baselineWins).toBe(1)
    expect(output.summary.challengerWins).toBe(0)
  })
})
