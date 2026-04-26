import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import { SNAPSHOT_MESSAGE_KINDS } from '../../behavioral.ts'
import { WORKER_EVENTS, WORKER_MESSAGE } from '../worker.constants.ts'

const WORKER_ENTRYPOINT = fileURLToPath(new URL('../cline.worker.ts', import.meta.url))
const TEST_WORKER_ID = 'cline-worker-runtime-ipc-test'

type WorkerIpcEnvelope = {
  message: {
    type: string
    detail: unknown
  }
}

type RuntimeErrorEnvelope = {
  message: {
    type: string
    detail: {
      kind: string
      error: string
    }
  }
}

type WaitForMessageOptions<T> = {
  messages: unknown[]
  predicate: (message: unknown) => message is T
  timeoutMs: number
  label: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isWorkerIpcEnvelope = (value: unknown): value is WorkerIpcEnvelope => {
  if (!isRecord(value)) return false
  if (!('message' in value)) return false
  if (!isRecord(value.message)) return false
  if (typeof value.message.type !== 'string') return false
  return 'detail' in value.message
}

const isSelectionEnvelope = (value: unknown): value is WorkerIpcEnvelope => {
  if (!isWorkerIpcEnvelope(value)) return false
  if (value.message.type !== WORKER_MESSAGE) return false
  if (!isRecord(value.message.detail)) return false
  return value.message.detail.kind === SNAPSHOT_MESSAGE_KINDS.selection
}

const isRuntimeErrorEnvelope = (value: unknown): value is RuntimeErrorEnvelope => {
  if (!isWorkerIpcEnvelope(value)) return false
  if (value.message.type !== WORKER_MESSAGE) return false
  if (!isRecord(value.message.detail)) return false
  if (value.message.detail.kind !== SNAPSHOT_MESSAGE_KINDS.runtime_error) return false
  return typeof value.message.detail.error === 'string'
}

const waitForMessage = async <T>({ messages, predicate, timeoutMs, label }: WaitForMessageOptions<T>): Promise<T> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const index = messages.findIndex((message) => predicate(message))
    if (index >= 0) {
      const [found] = messages.splice(index, 1)
      return found as T
    }
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

const waitForSetupSelection = async ({
  messages,
  worker,
}: {
  messages: unknown[]
  worker: Bun.Subprocess
}): Promise<WorkerIpcEnvelope> => {
  const setupEvent = {
    type: WORKER_EVENTS.setup,
    detail: { workerId: TEST_WORKER_ID },
  } as const

  for (let attempt = 0; attempt < 24; attempt += 1) {
    worker.send(setupEvent)
    try {
      return await waitForMessage({
        messages,
        predicate: isSelectionEnvelope,
        timeoutMs: 250,
        label: 'setup selection snapshot',
      })
    } catch {
      if (worker.exitCode !== null) {
        throw new Error(`Worker exited before setup snapshot: ${worker.exitCode}`)
      }
    }
  }
  throw new Error('Timed out waiting for setup snapshot from worker')
}

describe('cline worker runtime IPC boundary', () => {
  test('spawns over IPC, handles setup, and reports runtime errors for invalid payloads', async () => {
    const messages: unknown[] = []
    const worker = Bun.spawn(['bun', WORKER_ENTRYPOINT], {
      cwd: process.cwd(),
      ipc: (message) => {
        messages.push(message)
      },
    })

    expect(worker.pid).toBeGreaterThan(0)
    expect(typeof worker.send).toBe('function')

    try {
      const setupMessage = await waitForSetupSelection({ messages, worker })
      expect(setupMessage.message.type).toBe(WORKER_MESSAGE)
      expect(isRecord(setupMessage.message.detail)).toBe(true)
      expect((setupMessage.message.detail as Record<string, unknown>).kind).toBe(SNAPSHOT_MESSAGE_KINDS.selection)
      expect(worker.exitCode).toBeNull()

      worker.send('not-a-valid-bp-event')

      const runtimeErrorMessage = await waitForMessage({
        messages,
        predicate: isRuntimeErrorEnvelope,
        timeoutMs: 2_000,
        label: 'runtime_error snapshot',
      })
      expect(runtimeErrorMessage.message.type).toBe(WORKER_MESSAGE)
      expect(runtimeErrorMessage.message.detail.kind).toBe(SNAPSHOT_MESSAGE_KINDS.runtime_error)
      expect(runtimeErrorMessage.message.detail.error).toContain('Invalid input')
      expect(worker.exitCode).toBeNull()
    } finally {
      worker.kill()
      await worker.exited
    }
  })
})
