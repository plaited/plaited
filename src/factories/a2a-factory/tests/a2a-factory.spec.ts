import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { IDENTITY_TRUST_FACTORY_SIGNAL_KEYS } from '../../identity-trust-factory/identity-trust-factory.constants.ts'
import { IdentityTrustStateSchema } from '../../identity-trust-factory/identity-trust-factory.schemas.ts'
import { NODE_AUTH_FACTORY_SIGNAL_KEYS } from '../../node-auth-factory/node-auth-factory.constants.ts'
import { NodeAuthStateSchema } from '../../node-auth-factory/node-auth-factory.schemas.ts'
import { NODE_DISCOVERY_FACTORY_SIGNAL_KEYS } from '../../node-discovery-factory/node-discovery-factory.constants.ts'
import { NodeDiscoveryStateSchema } from '../../node-discovery-factory/node-discovery-factory.schemas.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../../tool-registry-factory/tool-registry-factory.constants.ts'
import { CapabilityRegistrySchema } from '../../tool-registry-factory/tool-registry-factory.schemas.ts'
import { A2A_FACTORY_EVENTS, A2A_FACTORY_SIGNAL_KEYS } from '../a2a-factory.constants.ts'
import type { A2AFactoryState, A2AFactoryStateSchema } from '../a2a-factory.policy.schemas.ts'
import { createA2AFactory } from '../a2a-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createA2AFactory', () => {
  test('projects a dynamic Agent Card and retains peer/task edge state', async () => {
    let stateSignal: Signal<typeof A2AFactoryStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:a2a',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          signals.set({
            key: TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry,
            schema: CapabilityRegistrySchema,
            value: [
              {
                id: 'search',
                name: 'Search',
                description: 'Search metadata',
                capabilityClass: 'built-in',
                sourceClass: 'core',
                tags: ['search'],
                authorityHints: ['read'],
              },
            ],
            readOnly: false,
          })
          signals.set({
            key: NODE_DISCOVERY_FACTORY_SIGNAL_KEYS.state,
            schema: NodeDiscoveryStateSchema,
            value: {
              nodeId: 'node:plaited',
              ownerHost: 'server',
              publicCardUrl: 'https://server/.well-known/agent-card.json',
              publicationStatus: 'published',
            },
            readOnly: false,
          })
          signals.set({
            key: NODE_AUTH_FACTORY_SIGNAL_KEYS.state,
            schema: NodeAuthStateSchema,
            value: {
              mode: 'platform_jwt',
              exposureLevel: 'public',
              authorityPolicy: 'balanced',
              session: {
                principalId: 'platform',
                trustClass: 'platform_edge',
                capabilities: ['invoke'],
                authenticatedAt: 100,
              },
            },
            readOnly: false,
          })
          signals.set({
            key: IDENTITY_TRUST_FACTORY_SIGNAL_KEYS.state,
            schema: IdentityTrustStateSchema,
            value: {
              localIdentityId: 'identity:plaited',
              discoveryNodeId: 'node:plaited',
              trustServiceProfile: 'local_store',
              auditBoundaries: ['workspace'],
              peers: [],
            },
            readOnly: false,
          })
          return {}
        },
        createA2AFactory(),
        ({ signals }) => {
          stateSignal = signals.get(A2A_FACTORY_SIGNAL_KEYS.state) as Signal<typeof A2AFactoryStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: A2A_FACTORY_EVENTS.a2a_factory_register_peer,
      detail: {
        peerId: 'peer:1',
        locator: 'https://peer.example/.well-known/agent-card.json',
        trustLevel: 'trusted',
      },
    })
    agent.trigger({
      type: A2A_FACTORY_EVENTS.a2a_factory_receive_message,
      detail: {
        peerId: 'peer:1',
        messageId: 'msg-1',
        taskId: 'task-1',
      },
    })
    agent.trigger({
      type: A2A_FACTORY_EVENTS.a2a_factory_complete_task,
      detail: {
        taskId: 'task-1',
      },
    })

    const state = stateSignal?.get() as A2AFactoryState | undefined
    expect(state?.card.url).toBe('https://server/.well-known/agent-card.json')
    expect(state?.card.skills?.map((skill) => skill.id)).toEqual(['search'])
    expect(state?.peers[0]?.peerId).toBe('peer:1')
    expect(state?.recentTasks[0]?.status).toBe('completed')
  })
})
