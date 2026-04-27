import { describe, expect, test } from 'bun:test'
import { hasDeadlocks, hasFeedbackErrors, hasRuntimeErrors, summarizeTrialProcess } from '../eval.process.ts'
import { PlaitedTraceSchema } from '../eval.schema.ts'

const trace = PlaitedTraceSchema.parse({
  snapshots: [
    {
      kind: 'selection',
      bids: [
        {
          thread: { label: 'planner' },
          source: 'request',
          selected: true,
          type: 'task.run',
          priority: 1,
        },
        {
          thread: { label: 'guard' },
          source: 'request',
          selected: false,
          type: 'task.run',
          priority: 2,
          blockedBy: { label: 'policy' },
          interrupts: { label: 'watchdog' },
        },
      ],
    },
    {
      kind: 'selection',
      bids: [
        {
          thread: { label: 'planner' },
          source: 'request',
          selected: true,
          type: 'task.run',
          priority: 1,
        },
      ],
    },
    {
      kind: 'deadlock',
      bids: [
        {
          thread: { label: 'planner' },
          source: 'request',
          selected: false,
          type: 'task.blocked',
          priority: 1,
          blockedBy: { label: 'policy' },
          reason: 'blocked',
        },
      ],
      summary: {
        candidateCount: 1,
        blockedCount: 1,
        unblockedCount: 0,
        blockers: [{ label: 'policy' }],
        interrupters: [],
      },
    },
    {
      kind: 'feedback_error',
      type: 'task.run',
      detail: { id: 'x' },
      error: 'handler failed',
    },
    {
      kind: 'runtime_error',
      error: 'panic',
    },
    {
      kind: 'worker',
      response: {
        id: 'worker-failure',
        exitCode: 1,
        timedOut: true,
      },
    },
  ],
  selectedEvents: [
    { type: 'task.run', detail: { id: 1 }, source: 'request' },
    { type: 'task.run', detail: { id: 2 }, source: 'request' },
  ],
  emittedEvents: [{ type: 'task.emit', detail: { ok: true }, source: 'emit' }],
  runtimeOutputs: [
    { kind: 'tool_bash_result', status: 'ok' },
    { kind: 'tool_bash_result', status: 'error', error: 'exit 1' },
  ],
})

describe('eval process diagnostics', () => {
  test('detects runtime/feedback/deadlock issues', () => {
    expect(hasRuntimeErrors({ trace })).toBe(true)
    expect(hasRuntimeErrors({ runnerError: 'boom' })).toBe(true)
    expect(hasRuntimeErrors({ timedOut: true })).toBe(true)
    expect(hasRuntimeErrors({})).toBe(false)

    expect(hasFeedbackErrors(trace)).toBe(true)
    expect(hasFeedbackErrors()).toBe(false)

    expect(hasDeadlocks(trace)).toBe(true)
    expect(hasDeadlocks()).toBe(false)
  })

  test('treats failed worker snapshots as runtime errors', () => {
    const workerFailureTrace = PlaitedTraceSchema.parse({
      snapshots: [
        {
          kind: 'worker',
          response: {
            id: 'shell-1',
            exitCode: 1,
            timedOut: false,
          },
        },
      ],
    })

    expect(hasRuntimeErrors({ trace: workerFailureTrace })).toBe(true)
    expect(summarizeTrialProcess({ trace: workerFailureTrace }).runtimeErrorCount).toBe(1)
  })
})

describe('summarizeTrialProcess', () => {
  test('summarizes trace metrics for post-run analysis', () => {
    const summary = summarizeTrialProcess({ trace, timedOut: true })

    expect(summary.coverage).toBe('snapshots-and-events')
    expect(summary.snapshotCount).toBe(6)
    expect(summary.selectionCount).toBe(2)
    expect(summary.selectedEventCount).toBe(2)
    expect(summary.emittedEventCount).toBe(1)
    expect(summary.deadlockCount).toBe(1)
    expect(summary.feedbackErrorCount).toBe(1)
    expect(summary.runtimeOutputCount).toBe(2)
    expect(summary.runtimeOutputErrorCount).toBe(1)
    expect(summary.runtimeErrorCount).toBe(4)
    expect(summary.blockedBidCount).toBe(2)
    expect(summary.interruptedBidCount).toBe(1)
    expect(summary.repeatedSelectionCount).toBe(1)
    expect(summary.maxConsecutiveSelectionTypeCount).toBe(2)
    expect(summary.runnerTimeoutCount).toBe(1)
    expect(summary.deadlockDetected).toBe(true)
    expect(summary.feedbackErrorDetected).toBe(true)
    expect(summary.runtimeErrorDetected).toBe(true)
  })
})
