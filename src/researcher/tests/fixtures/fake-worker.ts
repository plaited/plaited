import { join } from 'node:path'
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

const CONTEXT_PACKET = {
  summary: 'Focused context for deterministic researcher test flow.',
  filesToRead: ['src/researcher/research.ts', 'src/worker/pi.worker.ts'],
  symbolsOrTargets: ['runResearch', 'WORKER_EVENTS.run'],
  citedDocsSkills: [
    {
      kind: 'skill',
      reference: 'skills/plaited-runtime/SKILL.md',
      note: 'Behavioral orchestration guidance.',
    },
  ],
  claims: ['Worker runtime must be used as execution surface.'],
  rationale: 'Keep first pass narrow and explicit across event flow.',
  openQuestions: ['Should context packet include repo-specific confidence thresholds?'],
  suggestedChecks: ['bun --bun tsc --noEmit', 'bun test src/researcher/tests'],
  provenance: [
    {
      source: 'fixture',
      evidence: 'Deterministic fake worker fixture payload',
      confidence: 1,
    },
  ],
  review: 'Context packet is coherent but should keep worker lifecycle explicit.',
}

const CONSUMER_OUTPUT = {
  finalText: 'Implemented first-pass behavioral researcher loop with worker integration and durable observations.',
  filesWritten: ['written-by-consumer.txt', 'unchanged-existing.txt'],
  executionOutput: 'No runtime command execution in fixture mode.',
  testOutput: 'Targeted tests passed in fixture mode.',
  structuredOutcome: {
    confidence: 'high',
    mode: 'fixture',
  },
}

const MODEL_A_REVIEW =
  'Model A review: moderate risk remains around lifecycle edges; evidence and checks are present and output quality is acceptable.'

const chunkText = (value: string): string[] => {
  const chunkSize = 19
  const chunks: string[] = []
  for (let start = 0; start < value.length; start += chunkSize) {
    chunks.push(value.slice(start, start + chunkSize))
  }
  return chunks
}

const sendNoisyChunkedOutput = ({
  sessionId,
  workerId,
  payloadText,
}: {
  sessionId: string
  workerId: string
  payloadText: string
}): void => {
  sendSnapshot({
    kind: 'worker',
    workerId,
    sessionId,
    payload: {
      sourceEvent: 'tool_call',
      payload: {
        toolName: 'read',
        args: {
          file: 'README.md',
        },
      },
    },
  })

  sendSnapshot({
    kind: 'worker',
    workerId,
    sessionId,
    payload: {
      sourceEvent: 'agent_thought_chunk',
      payload: {
        text: 'noise-before',
      },
    },
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

  for (const chunk of chunkText(payloadText)) {
    sendSnapshot({
      kind: 'worker',
      workerId,
      sessionId,
      payload: {
        sourceEvent: 'agent_message_chunk',
        payload: {
          text: chunk,
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
      sourceEvent: 'agent_thought_chunk',
      payload: {
        text: 'noise-after',
      },
    },
  })

  sendSnapshot({
    kind: 'worker',
    workerId,
    sessionId,
    payload: {
      sourceEvent: 'tool_call_update',
      payload: {
        toolName: 'read',
        status: 'completed',
      },
    },
  })

  sendSnapshot({
    kind: 'worker',
    workerId,
    sessionId,
    payload: {
      researcherOutput: WorkerResearchOutputSchema.parse({
        kind: 'final_text',
        text: payloadText,
      }),
    },
  })
}

let setupWorkerId = ''

process.on('message', (message) => {
  if (!isRecord(message)) return
  const type = message.type
  if (typeof type !== 'string') return

  if (type === WORKER_EVENTS.setup) {
    const detail = isRecord(message.detail) ? message.detail : undefined
    const workerId = typeof detail?.workerId === 'string' ? detail.workerId : 'fixture-worker'
    setupWorkerId = workerId

    sendSnapshot({
      kind: 'selection',
      bids: [],
    })
    return
  }

  if (type !== WORKER_EVENTS.run) return

  const detail = isRecord(message.detail) ? message.detail : undefined
  const prompt = typeof detail?.prompt === 'string' ? detail.prompt : ''
  const cwd = typeof detail?.cwd === 'string' ? detail.cwd : process.cwd()
  const isContextPrompt = prompt.includes('MODEL_A_CONTEXT_ASSEMBLER')
  const isReviewPrompt = prompt.includes('MODEL_A_REVIEWER')

  if (!isContextPrompt && !isReviewPrompt && prompt.includes('FAIL_CONSUMER')) {
    sendSnapshot({
      kind: 'runtime_error',
      error: 'Forced consumer error from fake worker',
    })
    return
  }

  const sessionId = isContextPrompt
    ? 'fixture-context-session'
    : isReviewPrompt
      ? 'fixture-review-session'
      : 'fixture-consumer-session'

  if (!isContextPrompt && !isReviewPrompt) {
    void Bun.write(join(cwd, 'written-by-consumer.txt'), `created-by-fixture-worker-${Date.now()}\n`)
  }

  const payloadText = isContextPrompt
    ? JSON.stringify(CONTEXT_PACKET)
    : isReviewPrompt
      ? JSON.stringify({ review: MODEL_A_REVIEW })
      : JSON.stringify(CONSUMER_OUTPUT)

  sendNoisyChunkedOutput({
    sessionId,
    workerId: setupWorkerId || 'fixture-worker',
    payloadText,
  })

  sendSnapshot({
    kind: 'worker',
    workerId: setupWorkerId || 'fixture-worker',
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
