import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { WORKER_COMMAND_TYPES, WORKER_MESSAGE_TYPES } from '../worker.constants.ts'
import {
  type ExecMessage,
  ExecMessageSchema,
  type ReadMessage,
  ReadMessageSchema,
  type RuntimeErrorMessage,
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

const isExecResultMessageForTopic =
  (topic: string) =>
  (message: WorkerMessage): message is ExecMessage =>
    message.type === WORKER_MESSAGE_TYPES.exec_result && message.detail.topic === topic

const isReadResultMessageForTopic =
  (topic: string) =>
  (message: WorkerMessage): message is ReadMessage =>
    message.type === WORKER_MESSAGE_TYPES.read_result && message.detail.topic === topic

const isWriteResultMessageForTopic =
  (topic: string) =>
  (message: WorkerMessage): message is WriteMessage =>
    message.type === WORKER_MESSAGE_TYPES.write_result && message.detail.topic === topic

const isRuntimeErrorMessage = (message: WorkerMessage): message is RuntimeErrorMessage =>
  message.type === WORKER_MESSAGE_TYPES.runtime_error

describe('worker runtime messages', () => {
  test('executes a bun script that outputs JSON and returns the parsed result', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })
    const cwd = await mkdtemp(join(tmpdir(), 'worker-exec-'))

    try {
      const scriptPath = join(cwd, 'greet.ts')
      await Bun.write(
        scriptPath,
        `const input = JSON.parse(process.argv[2]);
console.log(JSON.stringify({ greeting: \`Hello, \${input.name}!\` }));`,
      )

      const waitForExec = waitForWorkerMessage({
        worker,
        predicate: isExecResultMessageForTopic('exec-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.exec,
        detail: {
          topic: 'exec-1',
          id: 'exec-1',
          cwd,
          command: 'bun',
          subCommand: scriptPath,
          json: JSON.stringify({ name: 'World' }),
        },
      })

      const execMessage = await waitForExec
      const { detail } = ExecMessageSchema.parse(execMessage)

      expect(detail.id).toBe('exec-1')
      expect(detail.topic).toBe('exec-1')
      expect(detail.result).toEqual({ greeting: 'Hello, World!' })
      expect(typeof detail.durationMs).toBe('number')
    } finally {
      worker.terminate()
      await rm(cwd, { recursive: true, force: true })
    }
  })

  test('executes a raw bun command with args and returns stdout text', async () => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url).href, { type: 'module' })

    try {
      const waitForExec = waitForWorkerMessage({
        worker,
        predicate: isExecResultMessageForTopic('exec-version'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.exec,
        detail: {
          topic: 'exec-version',
          id: 'exec-version',
          cwd: '/tmp',
          command: 'bun',
          subCommand: '--version',
        },
      })

      const execMessage = await waitForExec
      const { detail } = ExecMessageSchema.parse(execMessage)

      expect(detail.id).toBe('exec-version')
      expect(detail.topic).toBe('exec-version')
      expect(typeof detail.result).toBe('string')
      expect(detail.result).toContain('1.')
      expect(typeof detail.durationMs).toBe('number')
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
        predicate: isWriteResultMessageForTopic('write-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.write,
        detail: {
          topic: 'write-1',
          id: 'write-1',
          cwd,
          path: 'note.txt',
          content,
          encoding: 'utf8',
        },
      })

      const writeMessage = await waitForWrite
      const { detail } = WriteMessageSchema.parse(writeMessage)
      expect(detail.id).toBe('write-1')
      expect(detail.topic).toBe('write-1')
      expect(detail.path).toBe('note.txt')
      expect(detail.bytes).toBe(encoder.encode(content).length)

      const waitForRead = waitForWorkerMessage({
        worker,
        predicate: isReadResultMessageForTopic('read-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.read,
        detail: {
          topic: 'read-1',
          id: 'read-1',
          cwd,
          path: 'note.txt',
          encoding: 'utf8',
        },
      })

      const readMessage = await waitForRead
      const { detail: readDetail } = ReadMessageSchema.parse(readMessage)
      expect(readDetail.id).toBe('read-1')
      expect(readDetail.topic).toBe('read-1')
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
        predicate: isReadResultMessageForTopic('read-bytes-1'),
      })

      worker.postMessage({
        type: WORKER_COMMAND_TYPES.read,
        detail: {
          topic: 'read-bytes-1',
          id: 'read-bytes-1',
          cwd,
          path,
          encoding: 'bytes',
          maxBytes: 4,
        },
      })

      const readMessage = await waitForRead
      const { detail } = ReadMessageSchema.parse(readMessage)

      expect(detail.id).toBe('read-bytes-1')
      expect(detail.topic).toBe('read-bytes-1')
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
          topic: 'bad-read-1',
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
          topic: 'missing-read-1',
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
