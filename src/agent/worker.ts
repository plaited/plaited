import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import type { BPEvent } from '../behavioral/behavioral.schemas.ts'
import { behavioral, sync, thread } from '../behavioral.ts'
import { AGENT_TO_WORKER_EVENTS, WORKER_EVENTS, WORKER_TO_AGENT_EVENTS } from './agent.constants.ts'
import {
  type WorkerConnectDetail,
  WorkerConnectDetailSchema,
  type WorkerReadDetail,
  WorkerReadDetailSchema,
  type WorkerReadResponse,
  type WorkerShellDetail,
  WorkerShellDetailSchema,
  type WorkerShellResponse,
  type WorkerWriteDetail,
  WorkerWriteDetailSchema,
  type WorkerWriteResponse,
} from './worker.schema.ts'

const { useSnapshot, trigger, addHandler, addThread } = behavioral()

const send = (data: BPEvent) => self.postMessage(data)

useSnapshot((detail) => {
  send({
    type: WORKER_TO_AGENT_EVENTS.snapshot,
    detail,
  })
})

const messageHandler = ({ data }: { data: BPEvent }) => {
  trigger(data)
}

addThread(
  `on${AGENT_TO_WORKER_EVENTS.connect}`,
  thread(
    [
      sync({
        waitFor: {
          type: AGENT_TO_WORKER_EVENTS.connect,
          detailSchema: WorkerConnectDetailSchema,
        },
        block: [
          {
            type: AGENT_TO_WORKER_EVENTS.connect,
            detailSchema: WorkerConnectDetailSchema,
            detailMatch: 'invalid',
          },
          { type: WORKER_EVENTS.inference },
          { type: WORKER_EVENTS.read },
          { type: WORKER_EVENTS.write },
          { type: WORKER_EVENTS.shell },
        ],
      }),
    ],
    true,
  ),
)

addHandler<WorkerConnectDetail>(AGENT_TO_WORKER_EVENTS.connect, (detail) =>
  send({
    type: WORKER_TO_AGENT_EVENTS.connect_response,
    detail,
  }),
)

addThread(
  `on${WORKER_EVENTS.shell}`,
  thread([
    sync({
      block: {
        type: WORKER_EVENTS.shell,
        detailSchema: WorkerShellDetailSchema,
        detailMatch: 'invalid',
      },
    }),
  ]),
)

const limitTextBytes = (text: string, maxBytes: number) => {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length <= maxBytes) {
    return { text, truncated: false, originalBytes: bytes.length }
  }

  const sliced = bytes.slice(0, maxBytes)
  const limited = new TextDecoder().decode(sliced)
  return {
    text: limited,
    truncated: true,
    originalBytes: bytes.length,
  }
}

addHandler<WorkerShellDetail>(
  WORKER_EVENTS.shell,
  async ({ cwd, command, id, timeoutMs, maxOutputBytes = 256_000 }) => {
    const startedAt = Date.now()

    const controller = new AbortController()
    const timeout = timeoutMs && setTimeout(() => controller.abort(), timeoutMs)

    const proc = Bun.spawn(command, {
      cwd: cwd,
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

    const detail: WorkerShellResponse = {
      id,
      ok: exitCode === 0,
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

    trigger({
      type: WORKER_EVENTS.shell_response,
      detail,
    })
  },
)

addThread(
  `on${WORKER_EVENTS.read}`,
  thread([
    sync({
      block: {
        type: WORKER_EVENTS.read,
        detailSchema: WorkerReadDetailSchema,
        detailMatch: 'invalid',
      },
    }),
  ]),
)

const resolveRelativePathInsideCwd = ({ cwd, path }: { cwd: string; path: string }) => {
  if (isAbsolute(path)) {
    throw new Error(`Expected path to be relative to cwd: ${path}`)
  }

  const root = resolve(cwd)
  const target = resolve(root, path)
  const relation = relative(root, target)

  if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) {
    return target
  }

  throw new Error(`Path escapes cwd: ${path}`)
}

addHandler<WorkerReadDetail>(WORKER_EVENTS.read, async ({ id, cwd, path, encoding, maxBytes }) => {
  const target = resolveRelativePathInsideCwd({ cwd, path })
  const file = Bun.file(target)

  if (!(await file.exists())) {
    throw new Error(`File does not exist: ${path}`)
  }

  const bytes = await file.bytes()
  const max = maxBytes ?? bytes.length
  const sliced = bytes.length > max ? bytes.slice(0, max) : bytes

  const content = encoding === 'bytes' ? Buffer.from(sliced).toString('base64') : new TextDecoder().decode(sliced)

  const detail: WorkerReadResponse = {
    id,
    ok: true,
    cwd,
    path,
    encoding,
    content,
    bytes: bytes.length,
    truncated: bytes.length > max,
  }

  trigger({
    type: WORKER_EVENTS.read_response,
    detail,
  })
})

addThread(
  `on${WORKER_EVENTS.write}`,
  thread([
    sync({
      block: {
        type: WORKER_EVENTS.write,
        detailSchema: WorkerWriteDetailSchema,
        detailMatch: 'invalid',
      },
    }),
  ]),
)

addHandler<WorkerWriteDetail>(WORKER_EVENTS.write, async ({ id, cwd, path, content, encoding }) => {
  const root = resolve(cwd)
  const target = resolveRelativePathInsideCwd({ cwd, path })
  const parent = dirname(path)
  if (parent !== root) await mkdir(parent, { recursive: true })

  const data = encoding === 'base64' ? Uint8Array.fromBase64(content) : content
  const bytes = await Bun.write(target, data)

  const detail: WorkerWriteResponse = {
    id,
    ok: true,
    cwd,
    path,
    encoding,
    bytes,
  }

  trigger({
    type: WORKER_EVENTS.write_response,
    detail,
  })
})

addHandler(WORKER_EVENTS.inference, (_) => {})

self.addEventListener('message', messageHandler, false)
