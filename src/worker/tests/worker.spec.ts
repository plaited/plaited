import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { WORKER_COMMAND_TYPES, WORKER_MESSAGE_TYPES } from '../worker.constants.ts'
import {
  type ReadMessage,
  ReadMessageSchema,
  type RuntimeErrorMessage,
  type ShellMessage,
  ShellMessageSchema,
  type WorkerMessage,
  WorkerMessageSchema,
  type WriteMessage,
  WriteMessageSchema,
} from '../worker.schemas.ts'

const encoder = new TextEncoder()

const waitForWorkerMessage = <T extends WorkerMessage>({
  worker,
  predicate,
  timeoutMs = 5_000,
}: {
  worker: Worker
  predicate: (message: WorkerMessage) => message is T
  timeoutMs?: number
}) =>
  new Promise<T>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>

    const onMessage = (event: MessageEvent<unknown>) => {
      const parsed = WorkerMessageSchema.safeParse(event.data)
      if (!parsed.success) return
      if (!predicate(parsed.data)) return

      clearTimeout(timeout)
      worker.removeEventListener('message', onMessage)
      resolve(parsed.data)
    }

    timeout = setTimeout(() => {
      worker.removeEventListener('message', onMessage)
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for worker message`))
    }, timeoutMs)

    worker.addEventListener('message', onMessage)
  })

const isShellResultMessageForId =
  (id: string) =>
  (message: WorkerMessage): message is ShellMessage =>
    message.type === WORKER_MESSAGE_TYPES.shell_result && message.detail.id === id

const isReadResultMessageForId =
  (id: string) =>
  (message: WorkerMessage): message is ReadMessage =>
    message.type === WORKER_MESSAGE_TYPES.read_result && message.detail.id === id

const isWriteResultMessageForId =
  (id: string) =>
  (message: WorkerMessage): message is WriteMessage =>
    message.type === WORKER_MESSAGE_TYPES.write_result && message.detail.id === id

const isRuntimeErrorMessage = (message: WorkerMessage): message is RuntimeErrorMessage =>
  message.type === WORKER_MESSAGE_TYPES.runtime_error

const shellEmitScript = ({ stdout, stderr }: { stdout: string; stderr: string }) =>
  `process.stdout.write(${JSON.stringify(stdout)});process.stderr.write(${JSON.stringify(stderr)});`

describe('worker runtime messages', () => {
  test('emits shell result messages with byte-budget truncation for stdout/stderr', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })
    const cwd = process.cwd()

    try {
      const stdoutText = 'ABCDEFGHIJ'
      const stderrText = 'klmnopqrstuv'
      const maxOutputBytes = 9
      const stdoutBudget = Math.floor(maxOutputBytes / 2)
      const stderrBudget = maxOutputBytes - stdoutBudget

      const waitForShell = waitForWorkerMessage({
        worker,
        predicate: isShellResultMessageForId('shell-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.shell,
        detail: {
          id: 'shell-1',
          cwd,
          command: [process.execPath, '-e', shellEmitScript({ stdout: stdoutText, stderr: stderrText })],
          maxOutputBytes,
        },
      })

      const shellmessage = await waitForShell
      const { detail } = ShellMessageSchema.parse(shellmessage)

      expect(detail.exitCode).toBe(0)
      expect(detail.stdoutBytes).toBe(encoder.encode(stdoutText).length)
      expect(detail.stderrBytes).toBe(encoder.encode(stderrText).length)
      expect(detail.stdoutTruncated).toBe(true)
      expect(detail.stderrTruncated).toBe(true)
      expect(detail.stdout).toBe(stdoutText.slice(0, stdoutBudget))
      expect(detail.stderr).toBe(stderrText.slice(0, stderrBudget))
      expect(encoder.encode(detail.stdout).length).toBe(stdoutBudget)
      expect(encoder.encode(detail.stderr).length).toBe(stderrBudget)
      expect(detail.timedOut).toBe(false)
    } finally {
      worker.terminate()
    }
  })

  test('writes and then reads utf8 content', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })
    const cwd = await mkdtemp(join(tmpdir(), 'worker-spec-'))

    try {
      const content = 'hello from worker write/read'

      const waitForWrite = waitForWorkerMessage({
        worker,
        predicate: isWriteResultMessageForId('write-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.write,
        detail: {
          id: 'write-1',
          cwd,
          path: 'note.txt',
          content,
          encoding: 'utf8',
        },
      })

      const writeMessage = await waitForWrite
      const { detail } = WriteMessageSchema.parse(writeMessage)
      expect(detail.path).toBe('note.txt')
      expect(detail.bytes).toBe(encoder.encode(content).length)

      const waitForRead = waitForWorkerMessage({
        worker,
        predicate: isReadResultMessageForId('read-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.read,
        detail: {
          id: 'read-1',
          cwd,
          path: 'note.txt',
          encoding: 'utf8',
        },
      })

      const readMessage = await waitForRead
      const { detail: readDetail } = ReadMessageSchema.parse(readMessage)
      expect(readDetail.path).toBe('note.txt')
      expect(readDetail.encoding).toBe('utf8')
      expect(readDetail.content).toBe(content)
      expect(readDetail.bytes).toBe(encoder.encode(content).length)
      expect(readDetail.truncated).toBe(false)
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

      const waitForRead = waitForWorkerMessage({
        worker,
        predicate: isReadResultMessageForId('read-bytes-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.read,
        detail: {
          id: 'read-bytes-1',
          cwd,
          path,
          encoding: 'bytes',
          maxBytes: 4,
        },
      })

      const readMessage = await waitForRead
      const { detail } = ReadMessageSchema.parse(readMessage)

      expect(detail.encoding).toBe('bytes')
      expect(detail.bytes).toBe(6)
      expect(detail.truncated).toBe(true)
      expect(detail.content).toBe(Buffer.from('abcd').toString('base64'))
    } finally {
      worker.terminate()
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('reports runtime_error when incoming message is not a valid worker command envelope', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })

    try {
      const waitForRuntimeError = waitForWorkerMessage({
        worker,
        predicate: isRuntimeErrorMessage,
      })

      worker.postMessage('not-a-valid-bp-event')

      const message = await waitForRuntimeError
      expect(message.type).toBe(WORKER_MESSAGE_TYPES.runtime_error)
      expect(message.detail.error).toContain('Invalid input')
    } finally {
      worker.terminate()
    }
  })

  test('reports runtime_error when a known worker command has invalid detail', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })

    try {
      const waitForRuntimeError = waitForWorkerMessage({
        worker,
        predicate: isRuntimeErrorMessage,
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.read,
        detail: {
          id: 'bad-read-1',
          cwd: process.cwd(),
          path: 'note.txt',
          maxBytes: -1,
        },
      })

      const message = await waitForRuntimeError
      expect(message.type).toBe(WORKER_MESSAGE_TYPES.runtime_error)
      expect(message.detail.error).toContain('Too small')
    } finally {
      worker.terminate()
    }
  })

  test('reports runtime_error when read command targets a missing file', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })
    const cwd = await mkdtemp(join(tmpdir(), 'worker-spec-'))

    try {
      const waitForRuntimeError = waitForWorkerMessage({
        worker,
        predicate: isRuntimeErrorMessage,
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.read,
        detail: {
          id: 'missing-read-1',
          cwd,
          path: 'missing.txt',
        },
      })

      const message = await waitForRuntimeError
      expect(message.type).toBe(WORKER_MESSAGE_TYPES.runtime_error)
      expect(message.detail.error).toBe('File does not exist: missing.txt')
    } finally {
      worker.terminate()
      await rm(cwd, { recursive: true, force: true })
    }
  })
})
