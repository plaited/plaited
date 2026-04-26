import { WORKER_EVENTS, WORKER_MESSAGE } from '../../../worker/worker.constants.ts'
import { WorkerResearchOutputSchema } from '../../../worker/worker.schemas.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const sendSnapshot = (detail: unknown): void => {
  if (!process.send) return
  process.send({
    message: {
      type: WORKER_MESSAGE,
      detail,
    },
  })
}

const chunkText = (value: string): string[] => {
  const chunkSize = 13
  const chunks: string[] = []
  for (let start = 0; start < value.length; start += chunkSize) {
    chunks.push(value.slice(start, start + chunkSize))
  }
  return chunks
}

let setupWorkerId = ''

process.on('message', (message) => {
  if (!isRecord(message)) return
  if (typeof message.type !== 'string') return

  if (message.type === WORKER_EVENTS.setup) {
    const detail = isRecord(message.detail) ? message.detail : undefined
    setupWorkerId = typeof detail?.workerId === 'string' ? detail.workerId : 'fixture-review-worker'
    sendSnapshot({
      kind: 'selection',
      bids: [],
    })
    return
  }

  if (message.type !== WORKER_EVENTS.run) return
  const detail = isRecord(message.detail) ? message.detail : undefined
  const prompt = typeof detail?.prompt === 'string' ? detail.prompt : ''
  const workerId = setupWorkerId || 'fixture-review-worker'
  const sessionId = 'fixture-alt-review-session'

  if (!prompt.includes('MODEL_A_REVIEWER')) {
    sendSnapshot({
      kind: 'runtime_error',
      error: 'fake-review-worker only supports MODEL_A_REVIEWER prompts',
    })
    return
  }

  const reviewPayload = JSON.stringify({
    review: 'Alternate review worker selected explicitly for MODEL_A review stage.',
  })

  sendSnapshot({
    kind: 'worker',
    workerId,
    sessionId,
    payload: {
      sourceEvent: 'plan',
      stopReason: 'intermediate',
      payload: {
        note: 'non-terminal raw stop reason should not end the run',
      },
    },
  })

  for (const chunk of chunkText(reviewPayload)) {
    sendSnapshot({
      kind: 'worker',
      workerId,
      sessionId,
      payload: {
        type: 'message_update',
        assistantMessageEvent: {
          type: 'text_delta',
          delta: chunk,
        },
      },
    })

    sendSnapshot({
      kind: 'worker',
      workerId,
      sessionId,
      payload: {
        researcherOutput: WorkerResearchOutputSchema.parse({
          kind: 'text_chunk',
          text: chunk,
        }),
      },
    })
  }

  sendSnapshot({
    kind: 'worker',
    workerId,
    sessionId,
    payload: {
      researcherOutput: WorkerResearchOutputSchema.parse({
        kind: 'final_text',
        text: reviewPayload,
      }),
    },
  })

  sendSnapshot({
    kind: 'worker',
    workerId,
    sessionId,
    payload: {
      stopReason: 'end_turn',
      researcherOutput: WorkerResearchOutputSchema.parse({
        kind: 'completed',
        stopReason: 'end_turn',
      }),
    },
  })
})
