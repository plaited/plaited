import { describe, expect, test } from 'bun:test'
import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SnapshotMessage } from '../../behavioral.ts'
import { WORKER_EVENTS, WORKER_PATH } from '../../worker.ts'
import { RESEARCH_EVENTS } from '../research.constants.ts'
import { AnalystExecuteEventSchema } from '../research.schema.ts'
import { executeResearchWorkerShell } from '../research.ts'

const createWorkerSnapshot = ({ id }: { id: string }) => ({
  kind: 'worker',
  response: {
    id,
    exitCode: 0,
    signalCode: null,
    stdout: 'ok',
    stderr: '',
    stdoutBytes: 2,
    stderrBytes: 0,
    stdoutTruncated: false,
    stderrTruncated: false,
    stdoutPath: null,
    stderrPath: null,
    durationMs: 1,
    timedOut: false,
  },
})

describe('research execute worker runtime', () => {
  test('executes through production worker path using WORKER_PATH', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'research-worker-runtime-'))

    try {
      const response = await executeResearchWorkerShell({
        command: [process.execPath, '-e', 'process.stdout.write(process.cwd())'],
        cwd,
      })
      const expectedCwd = await realpath(cwd)
      const actualCwd = await realpath(response.stdout)

      expect(response.exitCode).toBe(0)
      expect(actualCwd).toBe(expectedCwd)
      expect(response.stderr).toBe('')
      expect(response.timedOut).toBe(false)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('uses WORKER_PATH and posts worker shell event with cwd', async () => {
    let workerPath = ''
    let workerOptions: WorkerOptions | undefined
    let terminated = false
    let postedMessage: unknown
    const snapshots: SnapshotMessage[] = []

    const fakeWorker = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage(message: unknown) {
        postedMessage = message
        const id = (message as { detail?: { id?: unknown } }).detail?.id
        if (typeof id !== 'string') {
          throw new Error('expected worker event id')
        }

        this.onmessage?.({
          data: createWorkerSnapshot({ id }),
        } as MessageEvent<unknown>)
      },
      terminate() {
        terminated = true
      },
    }

    const response = await executeResearchWorkerShell({
      command: ['pwd'],
      cwd: '/tmp/research-cwd',
      onSnapshot: (snapshot) => {
        snapshots.push(snapshot)
      },
      spawnWorker: ({ path, options }) => {
        workerPath = path
        workerOptions = options
        return fakeWorker
      },
    })

    const event = postedMessage as {
      type: string
      detail: {
        id: string
        command: string[]
        cwd: string
      }
    }

    expect(workerPath).toBe(WORKER_PATH)
    expect(workerOptions).toEqual({ type: 'module' })
    expect(event.type).toBe(WORKER_EVENTS.shell)
    expect(event.detail.command).toEqual(['pwd'])
    expect(event.detail.cwd).toBe('/tmp/research-cwd')
    expect(typeof event.detail.id).toBe('string')
    expect(response.id).toBe(event.detail.id)
    expect(terminated).toBe(true)
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.kind).toBe('worker')
  })

  test('propagates runtime_error snapshots as handler errors', async () => {
    let terminated = false

    const fakeWorker = {
      onmessage: null as ((event: MessageEvent<unknown>) => void) | null,
      onerror: null as ((event: ErrorEvent) => void) | null,
      postMessage() {
        this.onmessage?.({
          data: {
            kind: 'runtime_error',
            error: 'worker failed',
          },
        } as MessageEvent<unknown>)
      },
      terminate() {
        terminated = true
      },
    }

    await expect(
      executeResearchWorkerShell({
        command: ['pwd'],
        cwd: '/tmp/research-cwd',
        spawnWorker: () => fakeWorker,
      }),
    ).rejects.toThrow('worker failed')

    expect(terminated).toBe(true)
  })

  test('execute event schema aligns to worker command detail', () => {
    const valid = AnalystExecuteEventSchema.safeParse({
      type: RESEARCH_EVENTS.execute,
      detail: {
        command: ['pwd'],
        cwd: '/tmp/research-cwd',
      },
    })
    expect(valid.success).toBe(true)

    const invalid = AnalystExecuteEventSchema.safeParse({
      type: RESEARCH_EVENTS.execute,
      detail: {
        prompt: 'old prompt path',
        cwd: '/tmp/research-cwd',
      },
    })
    expect(invalid.success).toBe(false)
  })
})
