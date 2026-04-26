import type { AgentSession } from '@mariozechner/pi-coding-agent'
import {
  AuthStorage,
  createAgentSession,
  createCodingTools,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from '@mariozechner/pi-coding-agent'
import { BPEventSchema, behavioral, SNAPSHOT_MESSAGE_KINDS, sync, thread } from '../behavioral.ts'
import { WORKER_EVENTS, WORKER_MESSAGE } from './worker.constants.ts'
import {
  type WorkerCancelEventDetail,
  WorkerResearchOutputSchema,
  type WorkerRunEventDetail,
  type WorkerSetupEventDetail,
  WorkerSetupEventSchema,
} from './worker.schemas.ts'

const { useSnapshot, trigger, addHandler, addThread, reportSnapshot } = behavioral()

let workerId: WorkerSetupEventDetail['detail']['workerId']
type ActiveSession = {
  session: AgentSession
  unsubscribe: () => void
  cancelled: boolean
}

const sessions = new Map<string, ActiveSession>()

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const toPayloadRecord = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value as Record<string, unknown>
  }
  return { value }
}

const extractAssistantTextFromMessage = (value: unknown): string | undefined => {
  if (!isRecord(value)) return
  if (value.role !== 'assistant') return
  const content = value.content
  if (!Array.isArray(content)) return
  const textChunks: string[] = []
  for (const block of content) {
    if (!isRecord(block)) continue
    if (block.type !== 'text') continue
    const text = readString(block.text)
    if (text) textChunks.push(text)
  }
  const merged = textChunks.join('').trim()
  return merged.length > 0 ? merged : undefined
}

const extractPiOutputChunk = (payload: Record<string, unknown>): string | undefined => {
  if (payload.type !== 'message_update') return
  const assistantMessageEvent = payload.assistantMessageEvent
  if (!isRecord(assistantMessageEvent)) return
  if (assistantMessageEvent.type !== 'text_delta') return
  return readString(assistantMessageEvent.delta)
}

const extractPiFinalOutput = (payload: Record<string, unknown>): string | undefined => {
  if (payload.type === 'message_end') {
    return extractAssistantTextFromMessage(payload.message)
  }
  if (payload.type !== 'message_update') return
  const assistantMessageEvent = payload.assistantMessageEvent
  if (!isRecord(assistantMessageEvent) || assistantMessageEvent.type !== 'done') return
  return extractAssistantTextFromMessage(assistantMessageEvent.message)
}

const disposeSession = (sessionId: string): void => {
  const activeSession = sessions.get(sessionId)
  if (!activeSession) return
  sessions.delete(sessionId)
  activeSession.unsubscribe()
  activeSession.session.dispose()
}

useSnapshot((detail) => {
  if (!process.send) {
    throw new Error('pi.worker.ts requires an IPC parent process')
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
  const activeSession = sessions.get(sessionId)
  if (!activeSession) return
  activeSession.cancelled = true
  await activeSession.session.abort()
})

addHandler<WorkerRunEventDetail['detail']>(WORKER_EVENTS.run, async (detail) => {
  const { cwd, prompt } = detail
  const authStorage = AuthStorage.create()
  const modelRegistry = ModelRegistry.create(authStorage)
  const toolNames = createCodingTools(cwd).map((tool) => tool.name)
  const { session } = await createAgentSession({
    cwd,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
    }),
    tools: toolNames,
  })
  const sessionId = session.sessionId
  const streamedOutputChunks: string[] = []
  let emittedFinalOutput = false

  const unsubscribe = session.subscribe((event) => {
    const payload = toPayloadRecord(event)
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })

    const outputChunk = extractPiOutputChunk(payload)
    if (outputChunk) {
      streamedOutputChunks.push(outputChunk)
      reportSnapshot({
        kind: 'worker',
        sessionId,
        workerId,
        payload: {
          researcherOutput: WorkerResearchOutputSchema.parse({
            kind: 'text_chunk',
            text: outputChunk,
          }),
        },
      })
    }

    const finalOutput = extractPiFinalOutput(payload)
    if (finalOutput && !emittedFinalOutput) {
      emittedFinalOutput = true
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
  })

  const reportCompletion = (stopReason: string): void => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        stopReason,
        researcherOutput: WorkerResearchOutputSchema.parse({
          kind: 'completed',
          stopReason,
        }),
      },
    })
  }

  sessions.set(sessionId, {
    session,
    unsubscribe,
    cancelled: false,
  })

  try {
    await session.prompt(prompt)
    if (!emittedFinalOutput) {
      const reconstructedOutput = streamedOutputChunks.join('').trim()
      if (reconstructedOutput) {
        reportSnapshot({
          kind: 'worker',
          sessionId,
          workerId,
          payload: {
            researcherOutput: WorkerResearchOutputSchema.parse({
              kind: 'final_text',
              text: reconstructedOutput,
            }),
          },
        })
      }
    }
    const activeSession = sessions.get(sessionId)
    if (!activeSession?.cancelled) {
      reportCompletion('completed')
    }
  } catch (error) {
    const activeSession = sessions.get(sessionId)
    if (activeSession?.cancelled) {
      reportCompletion('aborted')
      return
    }
    throw error
  } finally {
    disposeSession(sessionId)
  }
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
