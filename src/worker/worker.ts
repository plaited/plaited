import { ClineAgent } from 'cline'
import { BPEventSchema, behavioral, SNAPSHOT_MESSAGE_KINDS, sync, thread } from '../behavioral.ts'
import { resolveRelativePath } from './resolve-relative-path.ts'
import { SESSION_EVENTS, WORKER_EVENTS, WORKER_MESSAGE } from './worker.constants.ts'
import {
  type WorkerCancelEventDetail,
  type WorkerRunEventDetail,
  type WorkerSetupEventDetail,
  WorkerSetupEventSchema,
} from './worker.schemas.ts'

const { useSnapshot, trigger, addHandler, addThread, reportSnapshot } = behavioral()

let workerId: WorkerSetupEventDetail['detail']['workerId']
const sessions = new Map<string, ClineAgent>()
/**
 * THIS IS WHERE WE'LL NEED TO DO THE MOST FORMATTING OF MESSAGE GOING OUT
 */
useSnapshot((detail) => {
  if (!process.send) {
    throw new Error('worker.ts requires an IPC parent process')
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
  // Auto-approve all tool calls
  agent.setPermissionHandler(async (request) => {
    const allow = request.options.find((o) => o.kind === 'allow_once')
    return {
      outcome: allow ? { outcome: 'selected', optionId: allow.optionId } : { outcome: 'cancelled' },
    }
  })

  const emitter = agent.emitterForSession(sessionId)
  emitter.on(SESSION_EVENTS.agent_message_chunk, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.agent_thought_chunk, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.tool_call, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.tool_call_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.plan, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.available_commands_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.current_mode_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.user_message_chunk, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.config_option_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.session_info_update, ({ _meta, ...payload }) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload,
    })
  })

  emitter.on(SESSION_EVENTS.error, (error) => {
    reportSnapshot({
      kind: 'worker',
      sessionId,
      workerId,
      payload: {
        error: error instanceof Error ? error.message : String(error),
      },
    })
  })

  const { stopReason } = await agent.prompt({
    sessionId,
    prompt: [{ type: 'text', text: prompt }],
  })

  reportSnapshot({
    kind: 'worker',
    sessionId,
    workerId,
    payload: {
      stopReason,
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
