import { ClineAgent } from 'cline'
import { BPEventSchema, behavioral, SNAPSHOT_MESSAGE_KINDS, sync, thread } from '../behavioral.ts'
import { keyMirror } from '../utils.ts'
import { resolveRelativePath } from './resolve-relative-path.ts'
import { WORKER_EVENTS, WORKER_MESSAGE } from './worker.constants.ts'
import {
  type WorkerCancelEventDetail,
  WorkerResearchOutputSchema,
  type WorkerRunEventDetail,
  type WorkerSetupEventDetail,
  WorkerSetupEventSchema,
} from './worker.schemas.ts'

const { useSnapshot, trigger, addHandler, addThread, reportSnapshot } = behavioral()

const CLINE_SESSION_EVENTS = keyMirror(
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan',
  'available_commands_update',
  'current_mode_update',
  'user_message_chunk',
  'config_option_update',
  'session_info_update',
  'error',
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const extractClineMessageChunk = (payload: Record<string, unknown>): string | undefined => {
  const directChunk = readString(payload.text) ?? readString(payload.chunk)
  if (directChunk) return directChunk
  const nestedPayload = payload.payload
  if (!isRecord(nestedPayload)) return
  return readString(nestedPayload.text) ?? readString(nestedPayload.chunk)
}

let workerId: WorkerSetupEventDetail['detail']['workerId']
const sessions = new Map<string, ClineAgent>()

useSnapshot((detail) => {
  if (!process.send) {
    throw new Error('cline.worker.ts requires an IPC parent process')
  }
  process?.send({
    message: {
      type: WORKER_MESSAGE,
      detail,
    },
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
        block: [{ type: WORKER_EVENTS.run }, { type: WORKER_EVENTS.cancel }],
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

addHandler<WorkerSetupEventDetail['detail']>(WORKER_EVENTS.setup, (detail) => {
  workerId = detail.workerId
})

addHandler<WorkerCancelEventDetail['detail']>(WORKER_EVENTS.cancel, async ({ sessionId }) => {
  const agent = sessions.get(sessionId)
  await agent?.cancel({ sessionId })
})

addHandler<WorkerRunEventDetail['detail']>(WORKER_EVENTS.run, async (detail) => {
  const { cwd, prompt } = detail
  const agent = new ClineAgent({
    clineDir: resolveRelativePath({
      cwd,
      path: '.cline',
    }),
  })
  await agent.initialize({
    protocolVersion: 1,
    clientCapabilities: {},
  })

  const { sessionId } = await agent.newSession({ cwd, mcpServers: [] })
  sessions.set(sessionId, agent)

  agent.setPermissionHandler(async (request) => {
    const allow = request.options.find((o) => o.kind === 'allow_once')
    return {
      outcome: allow ? { outcome: 'selected', optionId: allow.optionId } : { outcome: 'cancelled' },
    }
  })

  const emitter = agent.emitterForSession(sessionId)
  const streamedOutputChunks: string[] = []

  emitter.on(CLINE_SESSION_EVENTS.agent_message_chunk, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.agent_message_chunk,
        payload,
      },
    })

    const chunk = extractClineMessageChunk(payload)
    if (!chunk) return
    streamedOutputChunks.push(chunk)
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        researcherOutput: WorkerResearchOutputSchema.parse({
          kind: 'text_chunk',
          text: chunk,
        }),
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.agent_thought_chunk, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.agent_thought_chunk,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.tool_call, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.tool_call,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.tool_call_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.tool_call_update,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.plan, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.plan,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.available_commands_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.available_commands_update,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.current_mode_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.current_mode_update,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.user_message_chunk, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.user_message_chunk,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.config_option_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.config_option_update,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.session_info_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.session_info_update,
        payload,
      },
    })
  })

  emitter.on(CLINE_SESSION_EVENTS.error, (error) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        sourceEvent: CLINE_SESSION_EVENTS.error,
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
      },
    })
  })

  const { stopReason } = await agent.prompt({
    sessionId,
    prompt: [{ type: 'text', text: prompt }],
  })
  const normalizedStopReason = typeof stopReason === 'string' && stopReason.length > 0 ? stopReason : 'completed'

  const finalOutput = streamedOutputChunks.join('').trim()
  if (finalOutput) {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        researcherOutput: WorkerResearchOutputSchema.parse({
          kind: 'final_text',
          text: finalOutput,
        }),
      },
    })
  }

  reportSnapshot({
    kind: 'worker',
    sessionId,
    workerId,
    payload: {
      stopReason: normalizedStopReason,
      researcherOutput: WorkerResearchOutputSchema.parse({
        kind: 'completed',
        stopReason: normalizedStopReason,
      }),
    },
  })
  await agent.shutdown()
})

process.on('message', (message) => {
  try {
    const data = BPEventSchema.parse(message)
    trigger(data)
  } catch (error) {
    reportSnapshot({
      kind: SNAPSHOT_MESSAGE_KINDS.runtime_error,
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
