import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { type BPEvent, BPEventSchema, behavioral, sync, thread, useSpec } from '../behavioral.ts'
import { DelegatedListener, delegates } from '../utils.ts'
import {
  HARNESS_MESSAGE,
  INFERENCE,
  MAX_SOCKET_CONNECT_RETRIES,
  SOCKET_MESSAGE,
  SOCKET_RETRY_STATUS_CODES,
  WORKER_EVENTS,
  WORKER_MESSAGE,
  WORKER_TO_MODEL_MESSAGE_EVENT,
} from './agent.constants.ts'
import {
  type HarnessMessage,
  HarnessMessageSchema,
  type WorkerReadDetail,
  WorkerReadDetailSchema,
  type WorkerSetupEventDetail,
  WorkerSetupEventSchema,
  type WorkerShellDetail,
  WorkerShellDetailSchema,
  type WorkerUpdateSpecsDetail,
  WorkerUpdateSpecsDetailSchema,
  type WorkerWriteDetail,
  WorkerWriteDetailSchema,
} from './agent.schemas.ts'
import type {
  WorkerReadResponse,
  WorkerShellResponse,
  WorkerUpdateSpecsResponse,
  WorkerWriteResponse,
} from './agent.types.ts'

let socket: WebSocket | undefined
let retryCount = 0

const { useSnapshot, trigger, addHandler, addThread, reportError } = behavioral()

const useMessageEvent = (type: typeof SOCKET_MESSAGE | typeof HARNESS_MESSAGE) => {
  return (message: MessageEvent) => {
    try {
      const data = BPEventSchema.parse(JSON.parse(String(message.data)))
      trigger({
        type,
        detail: data,
      })
    } catch (error) {
      reportError(error instanceof Error ? error.message : String(error))
    }
  }
}

const onWsMessage = useMessageEvent(SOCKET_MESSAGE)

const socketListener = new DelegatedListener((event: Event) => {
  try {
    const target = event.target
    if (!(target instanceof WebSocket)) {
      throw new Error(`WebSocket listener received event without WebSocket target`)
    }
    if (target !== socket) return
    if (event.type === 'open') {
      retryCount = 0
      return
    }
    if (event instanceof MessageEvent) onWsMessage(event)
    if (event instanceof CloseEvent && SOCKET_RETRY_STATUS_CODES.has(event.code)) onRetry()
    if (event.type === 'error') {
      throw new Error(`WebSocket error on ${target.url} (readyState: ${target.readyState})`)
    }
  } catch (error) {
    reportError(error instanceof Error ? error.message : String(error))
  }
})

const closeSocket = () => {
  const ws = socket
  socket = undefined
  if (!ws) return
  ws.removeEventListener('open', socketListener)
  ws.removeEventListener('message', socketListener)
  ws.removeEventListener('error', socketListener)
  ws.removeEventListener('close', socketListener)
  if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) ws.close()
}

const connect = () => {
  if (!meta?.workerId) return
  if (socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) {
    return
  }
  closeSocket()
  socket = new WebSocket(`ws+unix://${socketPath}`, meta.workerId)
  delegates.set(socket, socketListener)
  socket.addEventListener('open', socketListener)
  socket.addEventListener('message', socketListener)
  socket.addEventListener('error', socketListener)
  socket.addEventListener('close', socketListener)
}

const onRetry = () => {
  closeSocket()
  if (retryCount >= MAX_SOCKET_CONNECT_RETRIES) return
  const maxDelay = Math.min(9_999, 1_000 * 2 ** retryCount)
  setTimeout(() => connect(), Math.floor(Math.random() * maxDelay))
  retryCount++
}

addHandler(WORKER_EVENTS.connect_socket, () => {
  socket = new WebSocket(`ws+unix://${socketPath}`, meta.workerId)
})

addHandler<HarnessMessage>(HARNESS_MESSAGE, (detail) => {
  const event = HarnessMessageSchema.parse(detail)
  trigger(event)
})

const sendSocket = (message: { type: string; detail?: unknown }) => {
  const onOpen = () => {
    sendSocket(message)
    socket?.removeEventListener('open', onOpen)
  }
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
    return
  }
  if (socket?.readyState === WebSocket.CLOSING || socket?.readyState === WebSocket.CLOSED) {
    closeSocket()
  }
  if (!socket) connect()
  socket?.addEventListener('open', onOpen)
}

const sendHarness = (data: BPEvent) => self.postMessage(data)

/**
 * THIS IS WHERE WE'LL NEED TO DO THE MOST FORMATTING OF MESSAGE GOING OUT
 */
useSnapshot((detail) => {
  sendHarness({
    type: WORKER_MESSAGE,
    detail,
  })
  sendSocket({
    type: WORKER_MESSAGE,
    detail,
  })
})

addThread(
  `Block event until setup`,
  thread(
    [
      sync({
        waitFor: {
          type: WORKER_EVENTS.setup,
          detailSchema: WorkerSetupEventSchema.shape.detail,
        },
        block: [
          { type: INFERENCE },
          { type: WORKER_EVENTS.connect_socket },
          { type: WORKER_EVENTS.get_context },
          { type: WORKER_EVENTS.heartbeat },
          { type: WORKER_EVENTS.prompt },
          { type: WORKER_EVENTS.read },
          { type: WORKER_EVENTS.shell },
          { type: WORKER_EVENTS.update_specs },
          { type: WORKER_EVENTS.write },
        ],
      }),
    ],
    true,
  ),
)

addThread(
  `Block re-setup attempts`,
  thread(
    [
      sync({
        waitFor: {
          type: WORKER_EVENTS.setup,
          detailSchema: WorkerSetupEventSchema.shape.detail,
        },
      }),
      sync({
        block: {
          type: WORKER_EVENTS.setup,
          detailSchema: WorkerSetupEventSchema.shape.detail,
        },
      }),
    ],
    true,
  ),
)

let meta: WorkerSetupEventDetail['detail']['meta']
let socketPath: string

addHandler<WorkerSetupEventDetail['detail']>(WORKER_EVENTS.setup, (detail) => {
  meta = detail.meta
  for (const spec of detail.specs) {
    addThread(...useSpec(spec))
  }
  socketPath = detail.socketPath
  trigger({ type: WORKER_EVENTS.connect_socket })
})

addThread(
  `Block invalid hhandler messages`,
  thread([
    sync({
      block: {
        type: WORKER_EVENTS.update_specs,
        detailSchema: WorkerUpdateSpecsDetailSchema,
        detailMatch: 'invalid',
      },
    }),
  ]),
)

addHandler<WorkerUpdateSpecsDetail>(WORKER_EVENTS.update_specs, ({ specs, planId }) => {
  for (const spec of specs) {
    addThread(...useSpec(spec))
  }
  const detail: WorkerUpdateSpecsResponse = {
    ok: true,
    planId,
  }

  trigger({
    type: WORKER_TO_MODEL_MESSAGE_EVENT.update_specs_response,
    detail,
  })
})

addThread(
  `Block invalid shell events`,
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

addHandler<WorkerShellDetail>(WORKER_EVENTS.shell, async ({ command, planId, timeoutMs, maxOutputBytes = 256_000 }) => {
  const startedAt = Date.now()
  const cwd = meta.cwd
  const controller = new AbortController()
  const timeout = timeoutMs && setTimeout(() => controller.abort(), timeoutMs)

  const proc = Bun.spawn(command, {
    cwd: meta.cwd,
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
    planId,
    cwd,
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
    type: WORKER_TO_MODEL_MESSAGE_EVENT.shell_response,
    detail,
  })
})

addThread(
  `Block invalid read events`,
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

addHandler<WorkerReadDetail>(WORKER_EVENTS.read, async ({ planId, path, encoding, maxBytes }) => {
  const cwd = meta.cwd
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
    planId,
    cwd,
    ok: true,
    path,
    encoding,
    content,
    bytes: bytes.length,
    truncated: bytes.length > max,
  }

  trigger({
    type: WORKER_TO_MODEL_MESSAGE_EVENT.read_response,
    detail,
  })
})

addThread(
  `Block invalid write events`,
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

addHandler<WorkerWriteDetail>(WORKER_EVENTS.write, async ({ planId, path, content, encoding }) => {
  const cwd = meta.cwd
  const root = resolve(cwd)
  const target = resolveRelativePathInsideCwd({ cwd, path })
  const parent = dirname(path)
  if (parent !== root) await mkdir(parent, { recursive: true })

  const data = encoding === 'base64' ? Uint8Array.fromBase64(content) : content
  const bytes = await Bun.write(target, data)

  const detail: WorkerWriteResponse = {
    planId,
    ok: true,
    cwd,
    path,
    encoding,
    bytes,
  }

  trigger({
    type: WORKER_TO_MODEL_MESSAGE_EVENT.write_response,
    detail,
  })
})

const onHarnessMessage = useMessageEvent(HARNESS_MESSAGE)

self.addEventListener('message', onHarnessMessage)
