import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { createObservabilityModule } from '../../observability-module/observability-module.ts'
import { createProjectionModule } from '../../projection-module/projection-module.ts'
import { MEMORY_MODULE_SIGNAL_KEYS } from '../memory-module.constants.ts'
import type { MemoryEpisodesSchema, WorkingMemorySchema } from '../memory-module.schemas.ts'
import { createMemoryModule } from '../memory-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createMemoryModule', () => {
  test('derives working observations and episodic memory from traces and projections', async () => {
    let workingSignal: Signal<typeof WorkingMemorySchema> | undefined
    let episodesSignal: Signal<typeof MemoryEpisodesSchema> | undefined

    const agent = await createAgent({
      id: 'agent:memory',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        createProjectionModule(),
        createObservabilityModule(),
        createMemoryModule({ observationBatchSize: 2 }),
        ({ signals }) => {
          workingSignal = signals.get(MEMORY_MODULE_SIGNAL_KEYS.working) as Signal<typeof WorkingMemorySchema>
          episodesSignal = signals.get(MEMORY_MODULE_SIGNAL_KEYS.episodes) as Signal<typeof MemoryEpisodesSchema>
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
