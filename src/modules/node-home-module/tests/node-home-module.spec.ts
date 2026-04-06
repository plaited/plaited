import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { EDIT_MODULE_SIGNAL_KEYS } from '../../edit-module/edit-module.constants.ts'
import { NullableEditStateSchema } from '../../edit-module/edit-module.schemas.ts'
import { MEMORY_MODULE_SIGNAL_KEYS } from '../../memory-module/memory-module.constants.ts'
import { MemoryEpisodesSchema } from '../../memory-module/memory-module.schemas.ts'
import { SESSION_PERSISTENCE_MODULE_SIGNAL_KEYS } from '../../session-persistence-module/session-persistence-module.constants.ts'
import { SessionPersistenceStateSchema } from '../../session-persistence-module/session-persistence-module.schemas.ts'
import { NODE_HOME_MODULE_EVENTS, NODE_HOME_MODULE_SIGNAL_KEYS } from '../node-home-module.constants.ts'
import type { NodeHomeState, NodeHomeStateSchema } from '../node-home-module.schemas.ts'
import { createNodeHomeModule } from '../node-home-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createNodeHomeModule', () => {
  test('retains durable artifacts and promotion state from persistence and edit signals', async () => {
    let nodeHomeSignal: Signal<typeof NodeHomeStateSchema> | undefined
    let editStateSignal: Signal<typeof NullableEditStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:node-home',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ signals }) => {
          signals.set({
            key: SESSION_PERSISTENCE_MODULE_SIGNAL_KEYS.state,
            schema: SessionPersistenceStateSchema,
            value: {
              recentArtifacts: [
                { kind: 'file', summary: 'src/modules/search-module/search-module.ts', timestamp: 100 },
                { kind: 'git', summary: 'commit:abc123', timestamp: 101 },
              ],
            },
            readOnly: false,
          })
          signals.set({
            key: MEMORY_MODULE_SIGNAL_KEYS.episodes,
            schema: MemoryEpisodesSchema,
            value: [
              {
                title: 'Episode planning',
                observationKinds: ['plan', 'projection'],
                summary: 'Planning episode retained',
                timestamp: 102,
              },
            ],
            readOnly: false,
          })
          editStateSignal = signals.set({
            key: EDIT_MODULE_SIGNAL_KEYS.state,
            schema: NullableEditStateSchema,
            value: null,
            readOnly: false,
          }) as Signal<typeof NullableEditStateSchema>
          return {}
        },
        createNodeHomeModule({ ownerHost: 'laptop' }),
        ({ signals }) => {
          nodeHomeSignal = signals.get(NODE_HOME_MODULE_SIGNAL_KEYS.state) as Signal<typeof NodeHomeStateSchema>
          return {}
        },
      ],
    })

    expect((nodeHomeSignal?.get() as NodeHomeState | undefined)?.ownerHost).toBe('laptop')
    expect((nodeHomeSignal?.get() as NodeHomeState | undefined)?.durableArtifacts.length).toBe(3)
    expect((nodeHomeSignal?.get() as NodeHomeState | undefined)?.status).toBe('active')

    editStateSignal?.set?.({
      intent: 'Prepare multi-file edit for persistence',
      files: ['src/modules/node-home-module/node-home-module.ts'],
      strategy: 'multi_file',
      status: 'ready_for_verification',
      changedFiles: ['src/modules/node-home-module/node-home-module.ts'],
    })

    expect((nodeHomeSignal?.get() as NodeHomeState | undefined)?.status).toBe('handoff_ready')

    agent.trigger({
      type: NODE_HOME_MODULE_EVENTS.node_home_module_checkpoint,
      detail: { reason: 'bounded checkpoint' },
    })
    agent.trigger({
      type: NODE_HOME_MODULE_EVENTS.node_home_module_export,
      detail: { targetHost: 'server', bundleId: 'bundle-1' },
    })
    agent.trigger({
      type: NODE_HOME_MODULE_EVENTS.node_home_module_handoff,
      detail: { targetHost: 'server', bundleId: 'bundle-1' },
    })

    const state = nodeHomeSignal?.get() as NodeHomeState | undefined
    expect(state?.lastCheckpointAt).toBeNumber()
    expect(state?.lastPromotion?.mode).toBe('handoff')
    expect(state?.lastPromotion?.targetHost).toBe('server')
    expect(state?.ownerHost).toBe('server')
  })
})
