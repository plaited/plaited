import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { $ } from 'bun'

import { resolveRelativePath } from './resolve-relative-path.ts'
import { WORKER_COMMAND_TYPES, WORKER_MESSAGE_TYPES } from './worker.constants.ts'
import {
  type ExecCommand,
  type ReadCommand,
  WorkerCommandSchema,
  type WorkerMessage,
  type WriteCommand,
} from './worker.schemas.ts'

const postMessageToHost = (message: WorkerMessage) => {
  self.postMessage(message)
}

const handleExec = async ({ topic, cwd, runtime, target, json }: ExecCommand['detail']) => {
  const startedAt = Date.now()

  const shellCmd = runtime === 'plaited' ? $`plaited ${target} '${json}'`.cwd(cwd) : $`bun ${target} '${json}'`.cwd(cwd)

  const result = await shellCmd.json()

  postMessageToHost({
    type: WORKER_MESSAGE_TYPES.exec_result,
    detail: { topic, result, durationMs: Date.now() - startedAt },
  })
}

const handleRead = async ({ topic, path, encoding, maxBytes, cwd }: ReadCommand['detail']) => {
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
      topic,
      cwd,
      path,
      encoding,
      content,
      bytes: bytes.length,
      truncated: bytes.length > max,
    },
  })
}

const handleWrite = async ({ topic, path, content, encoding, cwd }: WriteCommand['detail']) => {
  const root = resolve(cwd)
  const target = resolveRelativePath({ cwd, path })
  const parent = dirname(target)
  if (parent !== root) await mkdir(parent, { recursive: true })

  const data = encoding === 'base64' ? Uint8Array.fromBase64(content) : content
  const bytes = await Bun.write(target, data)

  postMessageToHost({
    type: WORKER_MESSAGE_TYPES.write_result,
    detail: {
      topic,
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
    type === WORKER_COMMAND_TYPES.exec
      ? await handleExec(detail)
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
