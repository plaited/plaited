import { afterEach, describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import {
  behavioral,
  SNAPSHOT_MESSAGE_KINDS,
  type SnapshotMessage,
  useExtension,
  useInstaller,
} from '../../behavioral.ts'
import {
  createExecutionProcessActorExtension,
  EXECUTION_PROCESS_ACTOR_EVENTS,
  ExecutionProcessRequestDetailSchema,
  type ExecutionProcessResultDetail,
  ExecutionProcessResultDetailSchema,
  executeExecutionProcessRequest,
  toExecutionProcessActorEventType,
} from '../execution-process-actor.ts'

const RESULTS_KEY = '__executionProcessActorResults'
const CAPTURE_EXTENSION_ID = 'execution_process_actor_test_capture'
const CAPTURE_EVENT = 'capture'
const CAPTURE_EVENT_TYPE = `${CAPTURE_EXTENSION_ID}:${CAPTURE_EVENT}`
const REQUEST_EVENT_TYPE = toExecutionProcessActorEventType(EXECUTION_PROCESS_ACTOR_EVENTS.request)
const RESULT_EVENT_TYPE = toExecutionProcessActorEventType(EXECUTION_PROCESS_ACTOR_EVENTS.result)

type ActorHarness = {
  snapshots: SnapshotMessage[]
  trigger: (event: { type: string; detail?: unknown }) => void
}

const readCapturedResults = () => {
  const state = globalThis as Record<string, unknown>
  const current = state[RESULTS_KEY]
  return Array.isArray(current) ? (current as ExecutionProcessResultDetail[]) : []
}

const createHarness = ({ workspaceRoot, maxOutputBytes }: { workspaceRoot: string; maxOutputBytes?: number }) => {
  const snapshots: SnapshotMessage[] = []
  const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
  const install = useInstaller({
    trigger,
    useSnapshot,
    reportSnapshot,
    addBThread,
    ttlMs: 1_000,
  })

  useFeedback(
    install(
      createExecutionProcessActorExtension({
        workspaceRoot,
        ...(maxOutputBytes !== undefined && { maxOutputBytes }),
      }),
    ),
  )
  useFeedback(
    install(
      useExtension(CAPTURE_EXTENSION_ID, ({ memory }) => ({
        [CAPTURE_EVENT]() {
          const current = readCapturedResults()
          const parsed = ExecutionProcessResultDetailSchema.safeParse(memory.get(RESULT_EVENT_TYPE)?.body)
          if (!parsed.success) {
            return
          }
          ;(globalThis as Record<string, unknown>)[RESULTS_KEY] = [...current, parsed.data]
        },
      })),
    ),
  )
  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })

  return {
    snapshots,
    trigger,
  } satisfies ActorHarness
}

const waitForCapturedResults = async ({
  harness,
  count,
  timeoutMs = 3_000,
}: {
  harness: ActorHarness
  count: number
  timeoutMs?: number
}) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    harness.trigger({ type: CAPTURE_EVENT_TYPE })
    const results = readCapturedResults()
    if (results.length >= count) {
      return results
    }
    await Bun.sleep(10)
  }

  throw new Error(`Timed out waiting for ${count} execution result event(s)`)
}

const waitForFeedbackError = async ({
  snapshots,
  type,
  timeoutMs = 3_000,
}: {
  snapshots: SnapshotMessage[]
  type: string
  timeoutMs?: number
}) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= timeoutMs) {
    const match = snapshots.find(
      (snapshot) => snapshot.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error && snapshot.type === type,
    )
    if (match && match.kind === SNAPSHOT_MESSAGE_KINDS.feedback_error) {
      return match
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for feedback_error snapshot for "${type}"`)
}

afterEach(() => {
  const state = globalThis as Record<string, unknown>
  delete state[RESULTS_KEY]
})

describe('execution process actor extension', () => {
  test('emits result event for native execution request happy path', async () => {
    const harness = createHarness({
      workspaceRoot: process.cwd(),
    })

    const detail = ExecutionProcessRequestDetailSchema.parse({
      requestId: 'req-actor-happy',
      correlationId: 'corr-actor-happy',
      command: 'bun',
      args: ['-e', 'process.stdout.write("actor-ok")'],
      cwd: '.',
    })
    harness.trigger({
      type: REQUEST_EVENT_TYPE,
      detail,
    })

    const results = await waitForCapturedResults({
      harness,
      count: 1,
    })
    expect(results).toHaveLength(1)
    expect(results[0]).toEqual({
      requestId: 'req-actor-happy',
      correlationId: 'corr-actor-happy',
      exitCode: 0,
      stdout: 'actor-ok',
      stderr: '',
      stdoutTruncated: false,
      stderrTruncated: false,
    })
  })

  test('requires cwd in native request detail', async () => {
    const harness = createHarness({
      workspaceRoot: process.cwd(),
    })

    harness.trigger({
      type: REQUEST_EVENT_TYPE,
      detail: {
        requestId: 'req-missing-cwd',
        correlationId: 'corr-missing-cwd',
        command: 'bun',
        args: [],
      } as unknown,
    })

    const feedbackError = await waitForFeedbackError({
      snapshots: harness.snapshots,
      type: REQUEST_EVENT_TYPE,
    })
    expect(feedbackError.error).toContain('cwd')
  })
})

describe('executeExecutionProcessRequest', () => {
  test('runs command from a workspace-relative cwd', async () => {
    const result = await executeExecutionProcessRequest({
      request: ExecutionProcessRequestDetailSchema.parse({
        requestId: 'req-relative-cwd',
        correlationId: 'corr-relative-cwd',
        command: 'bun',
        args: ['-e', 'process.stdout.write(process.cwd())'],
        cwd: 'src',
      }),
      workspaceRoot: process.cwd(),
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe(resolve(process.cwd(), 'src'))
    expect(result.stderr).toBe('')
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
  })

  test('rejects cwd that escapes the configured workspace', async () => {
    const result = await executeExecutionProcessRequest({
      request: ExecutionProcessRequestDetailSchema.parse({
        requestId: 'req-escape-cwd',
        correlationId: 'corr-escape-cwd',
        command: 'bun',
        args: ['-e', 'process.stdout.write("should-not-run")'],
        cwd: '../..',
      }),
      workspaceRoot: process.cwd(),
    })

    expect(result.exitCode).toBeNull()
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
    expect(result.error).toContain('outside workspace')
  })

  test('bounds stdout/stderr and reports truncation flags', async () => {
    const result = await executeExecutionProcessRequest({
      request: ExecutionProcessRequestDetailSchema.parse({
        requestId: 'req-truncated-streams',
        correlationId: 'corr-truncated-streams',
        command: 'bun',
        args: ['-e', 'process.stdout.write("a".repeat(120)); process.stderr.write("b".repeat(140));'],
        cwd: '.',
      }),
      workspaceRoot: process.cwd(),
      maxOutputBytes: 64,
    })

    expect(result.exitCode).toBe(0)
    expect(result.stdout.length).toBe(64)
    expect(result.stderr.length).toBe(64)
    expect(result.stdoutTruncated).toBe(true)
    expect(result.stderrTruncated).toBe(true)
  })

  test('reports non-zero exits as structured results', async () => {
    const result = await executeExecutionProcessRequest({
      request: ExecutionProcessRequestDetailSchema.parse({
        requestId: 'req-non-zero',
        correlationId: 'corr-non-zero',
        command: 'bun',
        args: ['-e', 'process.exit(19)'],
        cwd: '.',
      }),
      workspaceRoot: process.cwd(),
    })

    expect(result.exitCode).toBe(19)
    expect(result.error).toBeUndefined()
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
  })

  test('reports spawn failures with nullable exitCode', async () => {
    const result = await executeExecutionProcessRequest({
      request: ExecutionProcessRequestDetailSchema.parse({
        requestId: 'req-spawn-failure',
        correlationId: 'corr-spawn-failure',
        command: '__plaited_nonexistent_command__',
        args: [],
        cwd: '.',
      }),
      workspaceRoot: process.cwd(),
    })

    expect(result.exitCode).toBeNull()
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('')
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error?.length).toBeGreaterThan(0)
  })

  test('reports timeout as structured result', async () => {
    const result = await executeExecutionProcessRequest({
      request: ExecutionProcessRequestDetailSchema.parse({
        requestId: 'req-timeout',
        correlationId: 'corr-timeout',
        command: 'bun',
        args: ['-e', 'await Bun.sleep(300); process.stdout.write("late-output");'],
        cwd: '.',
        timeoutMs: 20,
      }),
      workspaceRoot: process.cwd(),
    })

    expect(result.exitCode).toBeNull()
    expect(result.error).toContain('timed out')
    expect(result.stdoutTruncated).toBe(false)
    expect(result.stderrTruncated).toBe(false)
  })
})
