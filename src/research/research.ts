import {
  behavioral,
  SNAPSHOT_MESSAGE_KINDS,
  type SnapshotMessage,
  SnapshotMessageSchema,
  sync,
  thread,
} from '../behavioral.ts'
import { type ShellResponse, ShellResponseSchema, WORKER_EVENTS, WORKER_PATH } from '../worker.ts'

import { ANALYST_PORT, CODER_PORT, RESEARCH_EVENTS } from './research.constants.ts'
import type { AnalystExecuteEvent, ServeEvent } from './research.schema.ts'

const { trigger, addHandler, addThread, reportSnapshot } = behavioral()

type Runtimes = {
  analyst?: Bun.Subprocess
  coder?: Bun.Subprocess
}

const runtimes: Runtimes = {}

type ResearchWorker = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage: (message: unknown) => void
  terminate: () => void
}

type SpawnResearchWorker = ({ path, options }: { path: string; options: WorkerOptions }) => ResearchWorker

const spawnResearchWorker: SpawnResearchWorker = ({ path, options }) => new Worker(path, options)

type ExecuteResearchWorkerShellArgs = {
  command: string[]
  cwd: string
  timeoutMs?: number
  maxOutputBytes?: number
  onSnapshot?: (snapshot: SnapshotMessage) => void
  spawnWorker?: SpawnResearchWorker
}

export const executeResearchWorkerShell = async ({
  command,
  cwd,
  timeoutMs,
  maxOutputBytes,
  onSnapshot,
  spawnWorker = spawnResearchWorker,
}: ExecuteResearchWorkerShellArgs): Promise<ShellResponse> => {
  const id = `research-shell-${crypto.randomUUID()}`
  const worker = spawnWorker({
    path: WORKER_PATH,
    options: { type: 'module' },
  })

  return await new Promise<ShellResponse>((resolve, reject) => {
    let settled = false
    const detail: {
      id: string
      command: string[]
      cwd: string
      timeoutMs?: number
      maxOutputBytes?: number
    } = {
      id,
      command,
      cwd,
    }

    if (timeoutMs !== undefined) {
      detail.timeoutMs = timeoutMs
    }
    if (maxOutputBytes !== undefined) {
      detail.maxOutputBytes = maxOutputBytes
    }

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }
      settled = true
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
      callback()
    }

    worker.onmessage = (event) => {
      const parsedSnapshot = SnapshotMessageSchema.safeParse(event.data)
      if (!parsedSnapshot.success) {
        return
      }

      const snapshot = parsedSnapshot.data
      onSnapshot?.(snapshot)

      if (snapshot.kind === SNAPSHOT_MESSAGE_KINDS.runtime_error) {
        settle(() => {
          reject(new Error(snapshot.error))
        })
        return
      }

      if (snapshot.kind !== SNAPSHOT_MESSAGE_KINDS.worker) {
        return
      }

      const parsedResponse = ShellResponseSchema.safeParse(snapshot.response)
      if (!parsedResponse.success || parsedResponse.data.id !== id) {
        return
      }

      settle(() => {
        resolve(parsedResponse.data)
      })
    }

    worker.onerror = (event) => {
      const workerError = event.error instanceof Error ? event.error : new Error(event.message)
      settle(() => {
        reject(workerError)
      })
    }

    worker.postMessage({
      type: WORKER_EVENTS.shell,
      detail,
    })
  })
}

addThread(
  `Block event until start`,
  thread([
    sync({
      waitFor: {
        type: RESEARCH_EVENTS.start,
      },
      block: [
        { type: RESEARCH_EVENTS.check_health },
        { type: RESEARCH_EVENTS.context_ready },
        { type: RESEARCH_EVENTS.execute },
        { type: RESEARCH_EVENTS.serve },
        { type: RESEARCH_EVENTS.start },
        { type: RESEARCH_EVENTS.stop },
        { type: RESEARCH_EVENTS.vllm_ready },
      ],
    }),
  ]),
)

addThread(
  `Block re-start attempts`,
  thread(
    [
      sync({
        waitFor: {
          type: RESEARCH_EVENTS.start,
        },
      }),
      sync({
        block: {
          type: RESEARCH_EVENTS.start,
        },
      }),
    ],
    true,
  ),
)

addThread(
  `Serve on start`,
  thread([
    sync({
      waitFor: {
        type: RESEARCH_EVENTS.start,
      },
    }),
    sync({
      request: {
        type: RESEARCH_EVENTS.check_health,
      },
    }),
  ]),
)

addHandler(RESEARCH_EVENTS.check_health, async () => {
  const analystResponse = await fetch(`http://127.0.0.1:${ANALYST_PORT}/health`).catch(() => undefined)
  const coderResponse = await fetch(`http://127.0.0.1:${CODER_PORT}/health`).catch(() => undefined)

  trigger<ServeEvent>({
    type: RESEARCH_EVENTS.serve,
    detail: {
      analyst: !analystResponse?.ok,
      coder: !coderResponse?.ok,
    },
  })
})

addHandler<ServeEvent['detail']>(RESEARCH_EVENTS.serve, async ({ analyst, coder }) => {
  if (analyst) {
    runtimes.analyst = Bun.spawn(
      [
        'vllm',
        'serve',
        'google/gemma-4-31B-it',
        '--port',
        ANALYST_PORT,
        '--max-model-len',
        '16384',
        '--gpu-memory-utilization',
        '0.90',
        '--enable-auto-tool-choice',
        '--reasoning-parser',
        'gemma4',
        '--tool-call-parser',
        'gemma4',
        '--chat-template',
        `${import.meta.dir}/assets/tool_chat_template_gemma4.jinja`,
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'ignore',
      },
    )
  }

  if (coder) {
    runtimes.coder = Bun.spawn(
      [
        'vllm',
        'serve',
        'google/gemma-4-26B-A4B-it',
        '--port',
        CODER_PORT,
        '--max-model-len',
        '16384',
        '--gpu-memory-utilization',
        '0.90',
        '--enable-auto-tool-choice',
        '--reasoning-parser',
        'gemma4',
        '--tool-call-parser',
        'gemma4',
        '--chat-template',
        `${import.meta.dir}/assets/tool_chat_template_gemma4.jinja`,
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'ignore',
      },
    )
  }

  if (analyst) {
    let analystReady = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${ANALYST_PORT}/health`).catch(() => undefined)
      if (response?.ok) {
        analystReady = true
        break
      }
      await Bun.sleep(1000)
    }

    if (!analystReady) {
      throw new Error(`Analyst vLLM did not become healthy on port ${ANALYST_PORT}`)
    }
  }

  if (coder) {
    let coderReady = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${CODER_PORT}/health`).catch(() => undefined)
      if (response?.ok) {
        coderReady = true
        break
      }
      await Bun.sleep(1000)
    }

    if (!coderReady) {
      throw new Error(`Coder vLLM did not become healthy on port ${CODER_PORT}`)
    }
  }
  trigger({
    type: RESEARCH_EVENTS.vllm_ready,
  })
})

addHandler<AnalystExecuteEvent['detail']>(
  RESEARCH_EVENTS.execute,
  async ({ command, cwd, timeoutMs, maxOutputBytes }) => {
    await executeResearchWorkerShell({
      command,
      cwd,
      timeoutMs,
      maxOutputBytes,
      onSnapshot: reportSnapshot,
    })
  },
)
