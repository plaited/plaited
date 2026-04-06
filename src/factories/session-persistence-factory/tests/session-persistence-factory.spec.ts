import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createMemoryFactory } from '../../memory-factory/memory-factory.ts'
import { createObservabilityFactory } from '../../observability-factory/observability-factory.ts'
import { SESSION_PERSISTENCE_FACTORY_SIGNAL_KEYS } from '../session-persistence-factory.constants.ts'
import type { SessionPersistenceStateSchema } from '../session-persistence-factory.schemas.ts'
import { createSessionPersistenceFactory } from '../session-persistence-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createSessionPersistenceFactory', () => {
  test('retains bounded recent session artifacts from traces and working memory', async () => {
    let stateSignal: Signal<typeof SessionPersistenceStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:session-persistence',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createObservabilityFactory(),
        createMemoryFactory({ observationBatchSize: 1 }),
        createSessionPersistenceFactory(),
        ({ signals }) => {
          stateSignal = signals.get(SESSION_PERSISTENCE_FACTORY_SIGNAL_KEYS.state) as Signal<
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
