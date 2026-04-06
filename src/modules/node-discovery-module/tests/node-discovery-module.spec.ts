import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { NODE_HOME_MODULE_SIGNAL_KEYS } from '../../node-home-module/node-home-module.constants.ts'
import { NodeHomeStateSchema } from '../../node-home-module/node-home-module.schemas.ts'
import {
  NODE_DISCOVERY_MODULE_EVENTS,
  NODE_DISCOVERY_MODULE_SIGNAL_KEYS,
} from '../node-discovery-module.constants.ts'
import type { NodeDiscoveryState, NodeDiscoveryStateSchema } from '../node-discovery-module.schemas.ts'
import { createNodeDiscoveryModule } from '../node-discovery-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createNodeDiscoveryModule', () => {
  test('rebinds discovery metadata across host changes and publication', async () => {
    let discoverySignal: Signal<typeof NodeDiscoveryStateSchema> | undefined
    let nodeHomeSignal: Signal<typeof NodeHomeStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:node-discovery',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ signals }) => {
          nodeHomeSignal = signals.set({
            key: NODE_HOME_MODULE_SIGNAL_KEYS.state,
            schema: NodeHomeStateSchema,
            value: {
              ownerHost: 'laptop',
              status: 'active',
              durableArtifacts: [],
            },
            readOnly: false,
          }) as Signal<typeof NodeHomeStateSchema>
          return {}
        },
        createNodeDiscoveryModule({ nodeId: 'node:plaited' }),
        ({ signals }) => {
          discoverySignal = signals.get(NODE_DISCOVERY_MODULE_SIGNAL_KEYS.state) as Signal<
            typeof NodeDiscoveryStateSchema
          >
          return {}
        },
      ],
    })

    expect((discoverySignal?.get() as NodeDiscoveryState | undefined)?.nodeId).toBe('node:plaited')
    expect((discoverySignal?.get() as NodeDiscoveryState | undefined)?.ownerHost).toBe('laptop')

    nodeHomeSignal?.set?.({
      ownerHost: 'server',
      status: 'active',
      durableArtifacts: [],
    })

    expect((discoverySignal?.get() as NodeDiscoveryState | undefined)?.publicationStatus).toBe('publish_required')
    expect((discoverySignal?.get() as NodeDiscoveryState | undefined)?.publicCardUrl).toBe(
      'https://server/.well-known/agent-card.json',
    )

    agent.trigger({
      type: NODE_DISCOVERY_MODULE_EVENTS.node_discovery_module_publish,
      detail: {},
    })

    expect((discoverySignal?.get() as NodeDiscoveryState | undefined)?.publicationStatus).toBe('published')
    expect((discoverySignal?.get() as NodeDiscoveryState | undefined)?.lastPublishedAt).toBeNumber()
  })
})
