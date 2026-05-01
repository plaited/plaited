import { describe, expect, test } from 'bun:test'

import { summarizeEvalTrialProcess } from '../eval.process.ts'
import { EvalTrialSchema } from '../eval.schemas.ts'

const trial = EvalTrialSchema.parse({
  id: 'trial-process-1',
  cwd: '/tmp',
  task: {
    id: 'task-1',
    prompt: 'run task',
  },
  result: {
    status: 'completed',
    message: 'done',
  },
  snapshots: [
    {
      kind: 'selection',
      step: 0,
      selected: {
        type: 'alpha',
      },
    },
    {
      kind: 'selection',
      step: 1,
      selected: {
        type: 'alpha',
      },
    },
    {
      kind: 'selection',
      step: 2,
      selected: {
        type: 'beta',
      },
    },
    {
      kind: 'feedback_error',
      type: 'alpha',
      error: 'handler failed',
    },
    {
      kind: 'deadlock',
      step: 3,
    },
    {
      kind: 'runtime_error',
      error: 'runtime panic',
    },
    {
      kind: 'worker',
      response: {
        id: 'worker-1',
        exitCode: 1,
        timedOut: false,
        signalCode: null,
      },
    },
  ],
})

describe('summarizeEvalTrialProcess', () => {
  test('summarizes deterministic process diagnostics from snapshots', () => {
    const summary = summarizeEvalTrialProcess(trial)

    expect(summary.snapshotCount).toBe(7)
    expect(summary.selectionCount).toBe(3)
    expect(summary.feedbackErrorCount).toBe(1)
    expect(summary.deadlockCount).toBe(1)
    expect(summary.runtimeErrorCount).toBe(1)
    expect(summary.workerFailureCount).toBe(1)
    expect(summary.repeatedSelectionCount).toBe(1)
    expect(summary.maxRepeatedSelectionTypeCount).toBe(2)
    expect(summary.feedbackErrorDetected).toBe(true)
    expect(summary.deadlockDetected).toBe(true)
    expect(summary.runtimeErrorDetected).toBe(true)
    expect(summary.workerFailureDetected).toBe(true)
  })
})
