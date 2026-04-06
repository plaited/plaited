import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { IDENTITY_TRUST_MODULE_SIGNAL_KEYS } from '../../identity-trust-module/identity-trust-module.constants.ts'
import { IdentityTrustStateSchema } from '../../identity-trust-module/identity-trust-module.schemas.ts'
import { NODE_AUTH_MODULE_SIGNAL_KEYS } from '../../node-auth-module/node-auth-module.constants.ts'
import { NodeAuthStateSchema } from '../../node-auth-module/node-auth-module.schemas.ts'
import { NODE_DISCOVERY_MODULE_SIGNAL_KEYS } from '../../node-discovery-module/node-discovery-module.constants.ts'
import { NodeDiscoveryStateSchema } from '../../node-discovery-module/node-discovery-module.schemas.ts'
import { TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from '../../tool-registry-module/tool-registry-module.constants.ts'
import { CapabilityRegistrySchema } from '../../tool-registry-module/tool-registry-module.schemas.ts'
import { A2A_MODULE_EVENTS, A2A_MODULE_SIGNAL_KEYS } from '../a2a-module.constants.ts'
import type { A2AModuleState, A2AModuleStateSchema } from '../a2a-module.policy.schemas.ts'
import { createA2AModule } from '../a2a-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createA2AModule', () => {
  test('projects a dynamic Agent Card and retains peer/task edge state', async () => {
    let stateSignal: Signal<typeof A2AModuleStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:a2a',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      modules: [
        ({ signals }) => {
          signals.set({
            key: TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
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
            key: NODE_DISCOVERY_MODULE_SIGNAL_KEYS.state,
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
            key: NODE_AUTH_MODULE_SIGNAL_KEYS.state,
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
            key: IDENTITY_TRUST_MODULE_SIGNAL_KEYS.state,
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
        createA2AModule(),
        ({ signals }) => {
          stateSignal = signals.get(A2A_MODULE_SIGNAL_KEYS.state) as Signal<typeof A2AModuleStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: A2A_MODULE_EVENTS.a2a_module_register_peer,
      detail: {
        peerId: 'peer:1',
        locator: 'https://peer.example/.well-known/agent-card.json',
        trustLevel: 'trusted',
      },
    })
    agent.trigger({
      type: A2A_MODULE_EVENTS.a2a_module_receive_message,
      detail: {
        peerId: 'peer:1',
        messageId: 'msg-1',
        taskId: 'task-1',
      },
    })
    agent.trigger({
      type: A2A_MODULE_EVENTS.a2a_module_complete_task,
      detail: {
        taskId: 'task-1',
      },
    })

    const state = stateSignal?.get() as A2AModuleState | undefined
    expect(state?.card.url).toBe('https://server/.well-known/agent-card.json')
    expect(state?.card.skills?.map((skill) => skill.id)).toEqual(['search'])
    expect(state?.peers[0]?.peerId).toBe('peer:1')
    expect(state?.recentTasks[0]?.status).toBe('completed')
  })
})
