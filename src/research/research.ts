import * as z from 'zod'

import {
  type BThreads,
  behavioral,
  SNAPSHOT_MESSAGE_KINDS,
  type SnapshotMessage,
  SnapshotMessageSchema,
  type Spec,
  sync,
  thread,
  useSpec,
} from '../behavioral.ts'
import { isTypeOf } from '../utils.ts'
import { type ShellResponse, ShellResponseSchema, WORKER_EVENTS, WORKER_PATH } from '../worker.ts'

import { ANALYST_MODEL, ANALYST_PORT, CODER_MODEL, CODER_PORT, RESEARCH_EVENTS } from './research.constants.ts'
import {
  type AnalystExecuteEvent,
  type ResearchApprovalEvent,
  type ResearchContextReadyEvent,
  type ResearchContractViolationEvent,
  type ResearchControlEvent,
  ResearchControlEventSchema,
  type ResearchMessageEvent,
  type ResearchModelRequestEvent,
  type ResearchModelResponseEvent,
  ResearchModelResponseEventSchema,
  type ResearchRuntimeRole,
  type ResearchTaskEvent,
  type ResearchToolIntentEvent,
  type ResearchToolResultEvent,
  ResearchVllmChatCompletionResponseSchema,
  type ServeEvent,
} from './research.schema.ts'

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

const resolveRuntimePort = (runtime: ResearchRuntimeRole) => (runtime === 'analyst' ? ANALYST_PORT : CODER_PORT)

const resolveRuntimeModel = (runtime: ResearchRuntimeRole) => (runtime === 'analyst' ? ANALYST_MODEL : CODER_MODEL)

type ResearchControlRuntimeApi = Pick<
  ReturnType<typeof behavioral>,
  'addThread' | 'addHandler' | 'trigger' | 'reportSnapshot'
>

type InvokeResearchModel = ({
  request,
  context,
}: {
  request: ResearchModelRequestEvent['detail']
  context: ResearchContextReadyEvent['detail']
}) => Promise<unknown>

type ResearchDiagnosticPayload = NonNullable<ResearchContractViolationEvent['detail']['payload']>

const DiagnosticPayloadSchema = z.record(z.string(), z.json())

const invokeResearchModel: InvokeResearchModel = async ({ request, context }) => {
  const response = await fetch(`http://127.0.0.1:${resolveRuntimePort(request.runtime)}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model ?? resolveRuntimeModel(request.runtime),
      messages: context.messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
        ...(message.name ? { name: message.name } : {}),
      })),
      ...(context.tools ? { tools: context.tools } : {}),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxCompletionTokens === undefined ? {} : { max_completion_tokens: request.maxCompletionTokens }),
    }),
  })

  if (!response.ok) {
    throw new Error(`Model request failed for ${request.runtime} with status ${response.status}`)
  }

  return await response.json()
}

const formatZodIssues = (issues: z.ZodIssue[]) =>
  issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
    return `${path}: ${issue.message}`
  })

const createTaskKey = ({ runtime, taskId }: { runtime: ResearchRuntimeRole; taskId: string }) => `${runtime}:${taskId}`

const extractTaskIdFromDetail = (detail: unknown) => {
  if (!isTypeOf<Record<string, unknown>>(detail, 'object')) {
    return undefined
  }
  const taskId = detail.taskId
  return typeof taskId === 'string' && taskId.length > 0 ? taskId : undefined
}

const extractTaskIdFromEvent = (event: unknown) => {
  if (!isTypeOf<Record<string, unknown>>(event, 'object')) {
    return undefined
  }
  return extractTaskIdFromDetail(event.detail)
}

const toDiagnosticPayload = (value: unknown): ResearchDiagnosticPayload | undefined => {
  const parsed = DiagnosticPayloadSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

const RESEARCH_RUNTIME_ROLES: ResearchRuntimeRole[] = ['analyst', 'coder']

const createRuntimeTaskMatchSchema = ({ runtime }: { runtime: ResearchRuntimeRole }) =>
  z
    .object({
      runtime: z.literal(runtime),
      taskId: z.string().min(1),
    })
    .passthrough()

const createRuntimeMatchSchema = ({ runtime }: { runtime: ResearchRuntimeRole }) =>
  z
    .object({
      runtime: z.literal(runtime),
    })
    .passthrough()

const createTerminalMessageMatchSchema = ({ runtime }: { runtime: ResearchRuntimeRole }) =>
  z
    .object({
      runtime: z.literal(runtime),
      taskId: z.string().min(1),
      role: z.literal('assistant'),
      terminal: z.literal(true),
    })
    .passthrough()

const createRuntimeTaskMatchJsonSchema = ({ runtime }: { runtime: ResearchRuntimeRole }) => ({
  type: 'object',
  required: ['runtime', 'taskId'],
  properties: {
    runtime: { type: 'string', enum: [runtime] },
    taskId: { type: 'string', minLength: 1 },
  },
  additionalProperties: true,
})

type ModelResponseNormalizationResult =
  | {
      ok: true
      detail: ResearchModelResponseEvent['detail']
    }
  | {
      ok: false
      reason: string
      issues: string[]
      payload?: ResearchDiagnosticPayload
    }

const normalizeModelResponseDetail = ({
  request,
  responsePayload,
}: {
  request: ResearchModelRequestEvent['detail']
  responsePayload: unknown
}): ModelResponseNormalizationResult => {
  let parsedResponse: z.infer<typeof ResearchVllmChatCompletionResponseSchema>
  try {
    parsedResponse = ResearchVllmChatCompletionResponseSchema.parse(responsePayload)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        reason: 'Invalid vLLM chat-completions payload.',
        issues: formatZodIssues(error.issues),
        payload: toDiagnosticPayload(responsePayload),
      }
    }
    throw error
  }

  const choice = parsedResponse.choices[0]!
  const toolCalls = choice.message.tool_calls?.map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.function.name,
    arguments: toolCall.function.arguments,
  }))

  const modelResponseDetail: ResearchModelResponseEvent['detail'] = {
    taskId: request.taskId,
    runtime: request.runtime,
    ...(typeof choice.message.content === 'string' && choice.message.content.length > 0
      ? { content: choice.message.content }
      : {}),
    ...(choice.finish_reason === undefined ? {} : { finishReason: choice.finish_reason ?? null }),
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
  }

  try {
    return {
      ok: true,
      detail: ResearchModelResponseEventSchema.shape.detail.parse(modelResponseDetail),
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        reason: 'Model output could not be normalized into model_response.',
        issues: formatZodIssues(error.issues),
        payload: toDiagnosticPayload(modelResponseDetail),
      }
    }
    throw error
  }
}

export const createResearchContextBeforeModelRequestSpec = ({ runtime }: { runtime: ResearchRuntimeRole }): Spec => ({
  label: `research-context-before-model-request-${runtime}`,
  thread: {
    syncPoints: [
      {
        waitFor: [{ type: RESEARCH_EVENTS.task, detailSchema: createRuntimeTaskMatchJsonSchema({ runtime }) }],
      },
      {
        waitFor: [{ type: RESEARCH_EVENTS.context_ready, detailSchema: createRuntimeTaskMatchJsonSchema({ runtime }) }],
        block: [{ type: RESEARCH_EVENTS.model_request, detailSchema: createRuntimeTaskMatchJsonSchema({ runtime }) }],
      },
    ],
  },
})

export const createResearchControlProtocolThreads = (): BThreads => {
  const protocolThreads: BThreads = {}
  for (const runtime of RESEARCH_RUNTIME_ROLES) {
    const runtimeMatchSchema = createRuntimeMatchSchema({ runtime })
    const terminalMessageMatchSchema = createTerminalMessageMatchSchema({ runtime })
    const [specLabel, specThread] = useSpec(createResearchContextBeforeModelRequestSpec({ runtime }))

    protocolThreads[`research-task-window-${runtime}`] = thread([
      sync({
        waitFor: { type: RESEARCH_EVENTS.task, detailSchema: runtimeMatchSchema },
        block: [
          { type: RESEARCH_EVENTS.context_ready, detailSchema: runtimeMatchSchema },
          { type: RESEARCH_EVENTS.model_request, detailSchema: runtimeMatchSchema },
          { type: RESEARCH_EVENTS.model_response, detailSchema: runtimeMatchSchema },
          { type: RESEARCH_EVENTS.tool_intent, detailSchema: runtimeMatchSchema },
          { type: RESEARCH_EVENTS.tool_result, detailSchema: runtimeMatchSchema },
          { type: RESEARCH_EVENTS.message, detailSchema: runtimeMatchSchema },
          { type: RESEARCH_EVENTS.approval, detailSchema: runtimeMatchSchema },
        ],
      }),
      sync({
        waitFor: [
          { type: RESEARCH_EVENTS.message, detailSchema: terminalMessageMatchSchema },
          { type: RESEARCH_EVENTS.approval, detailSchema: createRuntimeTaskMatchSchema({ runtime }) },
        ],
        block: [{ type: RESEARCH_EVENTS.task, detailSchema: runtimeMatchSchema }],
      }),
    ])
    protocolThreads[specLabel] = specThread
  }
  return protocolThreads
}

export const addResearchControlPlane = ({
  runtime,
  invokeModel = invokeResearchModel,
}: {
  runtime: ResearchControlRuntimeApi
  invokeModel?: InvokeResearchModel
}) => {
  const { addThread: addRuntimeThread, addHandler: addRuntimeHandler, trigger: triggerRuntimeEvent } = runtime
  const activeTaskByRuntime = new Map<ResearchRuntimeRole, string>()
  const contextByTask = new Map<string, ResearchContextReadyEvent['detail']>()

  const reportContractViolation = (detail: ResearchContractViolationEvent['detail']) => {
    const { eventType, reason, issues } = detail
    runtime.reportSnapshot({
      kind: SNAPSHOT_MESSAGE_KINDS.runtime_error,
      error: `[research contract violation] ${eventType}: ${reason}. ${issues.join('; ')}`,
    })
  }

  for (const [label, threadFactory] of Object.entries(createResearchControlProtocolThreads())) {
    addRuntimeThread(label, threadFactory)
  }

  addRuntimeHandler<ResearchTaskEvent['detail']>(RESEARCH_EVENTS.task, (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId && activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.task,
        reason: `Runtime ${detail.runtime} already has active task ${activeTaskId}.`,
        issues: ['task event was accepted while another task was active.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
      return
    }

    activeTaskByRuntime.set(detail.runtime, detail.taskId)
    contextByTask.delete(createTaskKey(detail))
  })

  addRuntimeHandler<ResearchContextReadyEvent['detail']>(RESEARCH_EVENTS.context_ready, (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.context_ready,
        reason: `context_ready taskId ${detail.taskId} does not match active task.`,
        issues: ['context_ready requires an active task for the same runtime.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
      return
    }

    contextByTask.set(createTaskKey(detail), detail)
  })

  addRuntimeHandler<ResearchModelRequestEvent['detail']>(RESEARCH_EVENTS.model_request, async (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.model_request,
        reason: `model_request taskId ${detail.taskId} does not match active task.`,
        issues: ['model_request requires an active task for the same runtime.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
      return
    }

    const context = contextByTask.get(createTaskKey(detail))
    if (!context) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.model_request,
        reason: 'model_request was emitted before context_ready.',
        issues: ['context_ready must be selected before model_request.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
      return
    }

    const responsePayload = await invokeModel({ request: detail, context })
    const normalization = normalizeModelResponseDetail({
      request: detail,
      responsePayload,
    })
    if (!normalization.ok) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.model_response,
        reason: normalization.reason,
        issues: normalization.issues,
        taskId: detail.taskId,
        payload: normalization.payload,
      })
      return
    }

    triggerRuntimeEvent<ResearchModelResponseEvent>({
      type: RESEARCH_EVENTS.model_response,
      detail: normalization.detail,
    })
  })

  addRuntimeHandler<ResearchModelResponseEvent['detail']>(RESEARCH_EVENTS.model_response, (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.model_response,
        reason: `model_response taskId ${detail.taskId} does not match active task.`,
        issues: ['model_response requires an active task for the same runtime.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
      return
    }

    for (const toolCall of detail.toolCalls ?? []) {
      triggerRuntimeEvent<ResearchToolIntentEvent>({
        type: RESEARCH_EVENTS.tool_intent,
        detail: {
          taskId: detail.taskId,
          runtime: detail.runtime,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          arguments: toolCall.arguments,
        },
      })
    }

    const terminal = (detail.toolCalls?.length ?? 0) === 0

    if (detail.content) {
      triggerRuntimeEvent<ResearchMessageEvent>({
        type: RESEARCH_EVENTS.message,
        detail: {
          taskId: detail.taskId,
          runtime: detail.runtime,
          role: 'assistant',
          content: detail.content,
          terminal,
        },
      })
    }
  })

  addRuntimeHandler<ResearchToolIntentEvent['detail']>(RESEARCH_EVENTS.tool_intent, (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.tool_intent,
        reason: `tool_intent taskId ${detail.taskId} does not match active task.`,
        issues: ['tool_intent requires an active task for the same runtime.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
    }
  })

  addRuntimeHandler<ResearchToolResultEvent['detail']>(RESEARCH_EVENTS.tool_result, (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.tool_result,
        reason: `tool_result taskId ${detail.taskId} does not match active task.`,
        issues: ['tool_result requires an active task for the same runtime.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
    }
  })

  addRuntimeHandler<ResearchMessageEvent['detail']>(RESEARCH_EVENTS.message, (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.message,
        reason: `message taskId ${detail.taskId} does not match active task.`,
        issues: ['message requires an active task for the same runtime.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
      return
    }

    if (detail.terminal && detail.role === 'assistant') {
      activeTaskByRuntime.delete(detail.runtime)
      contextByTask.delete(createTaskKey(detail))
    }
  })

  addRuntimeHandler<ResearchApprovalEvent['detail']>(RESEARCH_EVENTS.approval, (detail) => {
    const activeTaskId = activeTaskByRuntime.get(detail.runtime)
    if (activeTaskId !== detail.taskId) {
      reportContractViolation({
        eventType: RESEARCH_EVENTS.approval,
        reason: `approval taskId ${detail.taskId} does not match active task.`,
        issues: ['approval requires an active task for the same runtime.'],
        taskId: detail.taskId,
        payload: toDiagnosticPayload(detail),
      })
      return
    }

    activeTaskByRuntime.delete(detail.runtime)
    contextByTask.delete(createTaskKey(detail))
  })

  const triggerResearchControlEvent = (event: unknown) => {
    const parsed = ResearchControlEventSchema.safeParse(event)
    if (parsed.success) {
      triggerRuntimeEvent<ResearchControlEvent>(parsed.data)
      return
    }

    reportContractViolation({
      eventType: 'research_control_event',
      reason: 'Invalid control event envelope.',
      issues: formatZodIssues(parsed.error.issues),
      taskId: extractTaskIdFromEvent(event),
      payload: toDiagnosticPayload(event),
    })
  }

  return {
    triggerResearchControlEvent,
  }
}

const researchControlPlane = addResearchControlPlane({
  runtime: {
    trigger,
    addHandler,
    addThread,
    reportSnapshot,
  },
})

export const triggerResearchControlEvent = researchControlPlane.triggerResearchControlEvent

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
        { type: RESEARCH_EVENTS.approval },
        { type: RESEARCH_EVENTS.check_health },
        { type: RESEARCH_EVENTS.context_ready },
        { type: RESEARCH_EVENTS.execute },
        { type: RESEARCH_EVENTS.message },
        { type: RESEARCH_EVENTS.model_request },
        { type: RESEARCH_EVENTS.model_response },
        { type: RESEARCH_EVENTS.serve },
        { type: RESEARCH_EVENTS.start },
        { type: RESEARCH_EVENTS.stop },
        { type: RESEARCH_EVENTS.task },
        { type: RESEARCH_EVENTS.tool_intent },
        { type: RESEARCH_EVENTS.tool_result },
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
        ANALYST_MODEL,
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
        CODER_MODEL,
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
