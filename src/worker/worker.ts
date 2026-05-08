import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { limitTextBytes } from './limit-text-bytes.ts'

import { resolveRelativePath } from './resolve-relative-path.ts'
import { WORKER_COMMAND_TYPES, WORKER_MESSAGE_TYPES } from './worker.constants.ts'
import {
  type ReadCommand,
  type ShellCommand,
  WorkerCommandSchema,
  type WorkerMessage,
  type WriteCommand,
} from './worker.schemas.ts'

const postMessageToHost = (message: WorkerMessage) => {
  self.postMessage(message)
}

const handleShell = async ({ cwd, command, id, timeoutMs, maxOutputBytes = 256_000 }: ShellCommand['detail']) => {
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

  postMessageToHost({
    type: WORKER_MESSAGE_TYPES.shell_result,
    detail: {
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
    },
  })
}

const handleRead = async ({ id, path, encoding, maxBytes, cwd }: ReadCommand['detail']) => {
  const target = resolveRelativePath({ cwd, path })
  const file = Bun.file(target)

  if (!(await file.exists())) {
    throw new Error(`File does not exist: ${path}`)
  }

  const bytes = await file.bytes()
  const max = maxBytes ?? bytes.length
  const sliced = bytes.length > max ? bytes.slice(0, max) : bytes

  const content = encoding === 'bytes' ? Buffer.from(sliced).toString('base64') : new TextDecoder().decode(sliced)

  postMessageToHost({
    type: WORKER_MESSAGE_TYPES.read_result,
    detail: {
      id,
      cwd,
      path,
      encoding,
      content,
      bytes: bytes.length,
      truncated: bytes.length > max,
    },
  })
}

const handleWrite = async ({ id, path, content, encoding, cwd }: WriteCommand['detail']) => {
  const root = resolve(cwd)
  const target = resolveRelativePath({ cwd, path })
  const parent = dirname(target)
  if (parent !== root) await mkdir(parent, { recursive: true })

  const data = encoding === 'base64' ? Uint8Array.fromBase64(content) : content
  const bytes = await Bun.write(target, data)

  postMessageToHost({
    type: WORKER_MESSAGE_TYPES.write_result,
    detail: {
      id,
      cwd,
      path,
      encoding,
      bytes,
    },
  })
}

const dispatchWorkerEvent = async (raw: unknown) => {
  try {
    const { type, detail } = WorkerCommandSchema.parse(raw)
    type === WORKER_COMMAND_TYPES.shell
      ? await handleShell(detail)
      : type === WORKER_COMMAND_TYPES.read
        ? await handleRead(detail)
        : await handleWrite(detail)
  } catch (error) {
    postMessageToHost({
      type: WORKER_MESSAGE_TYPES.runtime_error,
      detail: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

self.onmessage = (event: MessageEvent<unknown>) => void dispatchWorkerEvent(event.data)
