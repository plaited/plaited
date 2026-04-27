import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SNAPSHOT_MESSAGE_KINDS } from '../../behavioral/behavioral.constants.ts'
import type { RuntimeError, SnapshotMessage, WorkerSnapshot } from '../../behavioral/behavioral.schemas.ts'
import { SnapshotMessageSchema } from '../../behavioral/behavioral.schemas.ts'
import { WORKER_EVENTS } from '../worker.constants.ts'
import { ReadResponseSchema, ShellResponseSchema, WriteResponseSchema } from '../worker.schemas.ts'

const encoder = new TextEncoder()

const waitForSnapshot = <T extends SnapshotMessage>({
  worker,
  predicate,
  timeoutMs = 5_000,
}: {
  worker: Worker
  predicate: (snapshot: SnapshotMessage) => snapshot is T
  timeoutMs?: number
}) =>
  new Promise<T>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>

    const onMessage = (event: MessageEvent<unknown>) => {
      const parsed = SnapshotMessageSchema.safeParse(event.data)
      if (!parsed.success) return
      if (!predicate(parsed.data)) return

      clearTimeout(timeout)
      worker.removeEventListener('message', onMessage)
      resolve(parsed.data)
    }

    timeout = setTimeout(() => {
      worker.removeEventListener('message', onMessage)
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for worker snapshot`))
    }, timeoutMs)

    worker.addEventListener('message', onMessage)
  })

const isWorkerSnapshotForId =
  (id: string) =>
  (snapshot: SnapshotMessage): snapshot is WorkerSnapshot =>
    snapshot.kind === SNAPSHOT_MESSAGE_KINDS.worker &&
    typeof snapshot.response.id === 'string' &&
    snapshot.response.id === id

const isRuntimeErrorSnapshot = (snapshot: SnapshotMessage): snapshot is RuntimeError =>
  snapshot.kind === SNAPSHOT_MESSAGE_KINDS.runtime_error

const shellEmitScript = ({ stdout, stderr }: { stdout: string; stderr: string }) =>
  `process.stdout.write(${JSON.stringify(stdout)});process.stderr.write(${JSON.stringify(stderr)});`

describe('worker runtime snapshots', () => {
  test('emits shell snapshots with byte-budget truncation for stdout/stderr', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })
    const cwd = process.cwd()

    try {
      const stdoutText = 'ABCDEFGHIJ'
      const stderrText = 'klmnopqrstuv'
      const maxOutputBytes = 9
      const stdoutBudget = Math.floor(maxOutputBytes / 2)
      const stderrBudget = maxOutputBytes - stdoutBudget

      const waitForShell = waitForSnapshot({
        worker,
        predicate: isWorkerSnapshotForId('shell-1'),
      })

      worker.postMessage({
        type: WORKER_EVENTS.shell,
        detail: {
          id: 'shell-1',
          cwd,
          command: [process.execPath, '-e', shellEmitScript({ stdout: stdoutText, stderr: stderrText })],
          maxOutputBytes,
        },
      })

      const snapshot = await waitForShell
      const response = ShellResponseSchema.parse(snapshot.response)

      expect(response.exitCode).toBe(0)
      expect(response.stdoutBytes).toBe(encoder.encode(stdoutText).length)
      expect(response.stderrBytes).toBe(encoder.encode(stderrText).length)
      expect(response.stdoutTruncated).toBe(true)
      expect(response.stderrTruncated).toBe(true)
      expect(response.stdout).toBe(stdoutText.slice(0, stdoutBudget))
      expect(response.stderr).toBe(stderrText.slice(0, stderrBudget))
      expect(encoder.encode(response.stdout).length).toBe(stdoutBudget)
      expect(encoder.encode(response.stderr).length).toBe(stderrBudget)
      expect(response.timedOut).toBe(false)
    } finally {
      worker.terminate()
    }
  })

  test('writes and then reads utf8 content', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })
    const cwd = await mkdtemp(join(tmpdir(), 'worker-spec-'))

    try {
      const content = 'hello from worker write/read'

      const waitForWrite = waitForSnapshot({
        worker,
        predicate: isWorkerSnapshotForId('write-1'),
      })

      worker.postMessage({
        type: WORKER_EVENTS.write,
        detail: {
          id: 'write-1',
          cwd,
          path: 'note.txt',
          content,
          encoding: 'utf8',
        },
      })

      const writeSnapshot = await waitForWrite
      const writeResponse = WriteResponseSchema.parse(writeSnapshot.response)
      expect(writeResponse.path).toBe('note.txt')
      expect(writeResponse.bytes).toBe(encoder.encode(content).length)

      const waitForRead = waitForSnapshot({
        worker,
        predicate: isWorkerSnapshotForId('read-1'),
      })

      worker.postMessage({
        type: WORKER_EVENTS.read,
        detail: {
          id: 'read-1',
          cwd,
          path: 'note.txt',
          encoding: 'utf8',
        },
      })

      const readSnapshot = await waitForRead
      const readResponse = ReadResponseSchema.parse(readSnapshot.response)
      expect(readResponse.path).toBe('note.txt')
      expect(readResponse.encoding).toBe('utf8')
      expect(readResponse.content).toBe(content)
      expect(readResponse.bytes).toBe(encoder.encode(content).length)
      expect(readResponse.truncated).toBe(false)
    } finally {
      worker.terminate()
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('reads bytes payloads as base64 and reports truncation', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })
    const cwd = await mkdtemp(join(tmpdir(), 'worker-spec-'))
    const path = 'bytes.txt'

    try {
      await Bun.write(join(cwd, path), 'abcdef')

      const waitForRead = waitForSnapshot({
        worker,
        predicate: isWorkerSnapshotForId('read-bytes-1'),
      })

      worker.postMessage({
        type: WORKER_EVENTS.read,
        detail: {
          id: 'read-bytes-1',
          cwd,
          path,
          encoding: 'bytes',
          maxBytes: 4,
        },
      })

      const readSnapshot = await waitForRead
      const readResponse = ReadResponseSchema.parse(readSnapshot.response)

      expect(readResponse.encoding).toBe('bytes')
      expect(readResponse.bytes).toBe(6)
      expect(readResponse.truncated).toBe(true)
      expect(readResponse.content).toBe(Buffer.from('abcd').toString('base64'))
    } finally {
      worker.terminate()
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('reports runtime_error when incoming message is not a valid BPEvent payload', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })

    try {
      const waitForRuntimeError = waitForSnapshot({
        worker,
        predicate: isRuntimeErrorSnapshot,
      })

      worker.postMessage('not-a-valid-bp-event')

      const snapshot = await waitForRuntimeError
      expect(snapshot.kind).toBe(SNAPSHOT_MESSAGE_KINDS.runtime_error)
      expect(snapshot.error).toContain('Invalid input')
    } finally {
      worker.terminate()
    }
  })
})
