import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createObservabilityFactory } from '../../observability-factory/observability-factory.ts'
import { createProjectionFactory } from '../../projection-factory/projection-factory.ts'
import { MEMORY_FACTORY_SIGNAL_KEYS } from '../memory-factory.constants.ts'
import type { MemoryEpisodesSchema, WorkingMemorySchema } from '../memory-factory.schemas.ts'
import { createMemoryFactory } from '../memory-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createMemoryFactory', () => {
  test('derives working observations and episodic memory from traces and projections', async () => {
    let workingSignal: Signal<typeof WorkingMemorySchema> | undefined
    let episodesSignal: Signal<typeof MemoryEpisodesSchema> | undefined

    const agent = await createAgent({
      id: 'agent:memory',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createProjectionFactory(),
        createObservabilityFactory(),
        createMemoryFactory({ observationBatchSize: 2 }),
        ({ signals }) => {
          workingSignal = signals.get(MEMORY_FACTORY_SIGNAL_KEYS.working) as Signal<typeof WorkingMemorySchema>
          episodesSignal = signals.get(MEMORY_FACTORY_SIGNAL_KEYS.episodes) as Signal<typeof MemoryEpisodesSchema>
          return {
            handlers: {
              emit_memory_trace() {
                agent.trigger({ type: 'memory_test_event' })
              },
              memory_test_event() {},
            },
          }
        },
      ],
    })

    agent.trigger({ type: 'memory_test_event' })
    await Bun.sleep(50)

    expect((workingSignal?.get() ?? []).length).toBeGreaterThan(0)
    expect((episodesSignal?.get() ?? []).length).toBeGreaterThan(0)
  })
})
