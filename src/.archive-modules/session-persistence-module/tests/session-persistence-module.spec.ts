import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createMemoryModule } from '../../memory-module/memory-module.ts'
import { createObservabilityModule } from '../../observability-module/observability-module.ts'
import { SESSION_PERSISTENCE_MODULE_SIGNAL_KEYS } from '../session-persistence-module.constants.ts'
import type { SessionPersistenceStateSchema } from '../session-persistence-module.schemas.ts'
import { createSessionPersistenceModule } from '../session-persistence-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createSessionPersistenceModule', () => {
  test('retains bounded recent session artifacts from traces and working memory', async () => {
    let stateSignal: Signal<typeof SessionPersistenceStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:session-persistence',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createObservabilityModule(),
        createMemoryModule({ observationBatchSize: 1 }),
        createSessionPersistenceModule(),
        ({ signals }) => {
          stateSignal = signals.get(SESSION_PERSISTENCE_MODULE_SIGNAL_KEYS.state) as Signal<
            typeof SessionPersistenceStateSchema
          >
          return {}
        },
      ],
    })

    agent.trigger({ type: 'session_test_event' })
    await Bun.sleep(50)

    expect((stateSignal?.get()?.recentArtifacts ?? []).length).toBeGreaterThan(0)
  })
})
