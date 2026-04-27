import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import type { SnapshotMessage } from '../behavioral/behavioral.schemas.ts'
import { BPEventSchema, behavioral, SNAPSHOT_MESSAGE_KINDS, sync, thread } from '../behavioral.ts'
import { limitTextBytes } from './limit-text-bytes.ts'

import { resolveRelativePath } from './resolve-relative-path.ts'
import { WORKER_EVENTS } from './worker.constants.ts'
import {
  type ReadEvent,
  ReadEventSchema,
  type ShellEvent,
  ShellEventSchema,
  type ShellResponse,
  type WriteEvent,
  WriteEventSchema,
  type WriteResponse,
} from './worker.schemas.ts'

const { useSnapshot, trigger, addHandler, addThread, reportSnapshot } = behavioral()

const send = (data: SnapshotMessage) => self.postMessage(data)

useSnapshot((detail) => {
  send(detail)
})

addThread(
  'Block invalid events',
  thread(
    [
      sync({
        block: [
          { type: WORKER_EVENTS.shell, detailMatch: 'invalid', detailSchema: ShellEventSchema.shape.detail },
          { type: WORKER_EVENTS.write, detailMatch: 'invalid', detailSchema: WriteEventSchema.shape.detail },
          { type: WORKER_EVENTS.read, detailMatch: 'invalid', detailSchema: ReadEventSchema.shape.detail },
        ],
      }),
    ],
    true,
  ),
)

addHandler<ShellEvent['detail']>(
  WORKER_EVENTS.shell,
  async ({ cwd, command, id, timeoutMs, maxOutputBytes = 256_000 }) => {
    const startedAt = Date.now()

    const controller = new AbortController()
    const timeout = timeoutMs && setTimeout(() => controller.abort(), timeoutMs)

    const proc = Bun.spawn(command, {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      signal: controller.signal,
    })

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    timeout && clearTimeout(timeout)

    const stdoutResult = limitTextBytes(stdout, Math.floor(maxOutputBytes / 2))
    const stderrResult = limitTextBytes(stderr, maxOutputBytes - Math.floor(maxOutputBytes / 2))

    const response: ShellResponse = {
      id,
      exitCode,
      signalCode: null,
      stdout: stdoutResult.text,
      stderr: stderrResult.text,
      stdoutBytes: stdoutResult.originalBytes,
      stderrBytes: stderrResult.originalBytes,
      stdoutTruncated: stdoutResult.truncated,
      stderrTruncated: stderrResult.truncated,
      stdoutPath: null,
      stderrPath: null,
      durationMs: Date.now() - startedAt,
      timedOut: false,
    }

    reportSnapshot({
      kind: SNAPSHOT_MESSAGE_KINDS.worker,
      response,
    })
  },
)

addHandler<ReadEvent['detail']>(WORKER_EVENTS.read, async ({ id, path, encoding, maxBytes, cwd }) => {
  const target = resolveRelativePath({ cwd, path })
  const file = Bun.file(target)

  if (!(await file.exists())) {
    throw new Error(`File does not exist: ${path}`)
  }

  const bytes = await file.bytes()
  const max = maxBytes ?? bytes.length
  const sliced = bytes.length > max ? bytes.slice(0, max) : bytes

  const content = encoding === 'bytes' ? Buffer.from(sliced).toString('base64') : new TextDecoder().decode(sliced)

  const response = {
    id,
    cwd,
    path,
    encoding,
    content,
    bytes: bytes.length,
    truncated: bytes.length > max,
  }
  reportSnapshot({
    kind: SNAPSHOT_MESSAGE_KINDS.worker,
    response,
  })
})

addHandler<WriteEvent['detail']>(WORKER_EVENTS.write, async ({ id, path, content, encoding, cwd }) => {
  const root = resolve(cwd)
  const target = resolveRelativePath({ cwd, path })
  const parent = dirname(path)
  if (parent !== root) await mkdir(parent, { recursive: true })

  const data = encoding === 'base64' ? Uint8Array.fromBase64(content) : content
  const bytes = await Bun.write(target, data)

  const response: WriteResponse = {
    id,
    cwd,
    path,
    encoding,
    bytes,
  }

  reportSnapshot({
    kind: SNAPSHOT_MESSAGE_KINDS.worker,
    response,
  })
})

self.onmessage = (event: MessageEvent) => {
  try {
    const data = BPEventSchema.parse(event.data)
    trigger(data)
  } catch (error) {
    reportSnapshot({
      kind: SNAPSHOT_MESSAGE_KINDS.runtime_error,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
