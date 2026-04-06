import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { THREE_AXIS_FACTORY_SIGNAL_KEYS } from '../../three-axis-factory/three-axis-factory.constants.ts'
import { ThreeAxisStateSchema } from '../../three-axis-factory/three-axis-factory.schemas.ts'
import { NODE_AUTH_FACTORY_EVENTS, NODE_AUTH_FACTORY_SIGNAL_KEYS } from '../node-auth-factory.constants.ts'
import type { NodeAuthState, NodeAuthStateSchema } from '../node-auth-factory.schemas.ts'
import { createNodeAuthFactory } from '../node-auth-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createNodeAuthFactory', () => {
  test('projects auth mode and session state into exposure policy', async () => {
    let authSignal: Signal<typeof NodeAuthStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:node-auth',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
          signals.set({
            key: THREE_AXIS_FACTORY_SIGNAL_KEYS.state,
            schema: ThreeAxisStateSchema,
            value: {
              decisions: [
                {
                  capabilityId: 'bash',
                  authorityScope: 'workspace',
                  autonomyMode: 'owner_only',
                  verificationRequired: true,
                },
              ],
            },
            readOnly: false,
          })
          return {}
        },
        createNodeAuthFactory({ initialMode: 'webauthn' }),
        ({ signals }) => {
          authSignal = signals.get(NODE_AUTH_FACTORY_SIGNAL_KEYS.state) as Signal<typeof NodeAuthStateSchema>
          return {}
        },
      ],
    })

    expect((authSignal?.get() as NodeAuthState | undefined)?.exposureLevel).toBe('trusted')
    expect((authSignal?.get() as NodeAuthState | undefined)?.authorityPolicy).toBe('strict')

    agent.trigger({
      type: NODE_AUTH_FACTORY_EVENTS.node_auth_factory_authenticate,
      detail: {
        principalId: 'user:1',
        trustClass: 'local_user',
        capabilities: ['read', 'write'],
      },
    })
    agent.trigger({
      type: NODE_AUTH_FACTORY_EVENTS.node_auth_factory_set_mode,
      detail: { mode: 'dev' },
    })

    const state = authSignal?.get() as NodeAuthState | undefined
    expect(state?.session?.principalId).toBe('user:1')
    expect(state?.mode).toBe('dev')
    expect(state?.exposureLevel).toBe('private')
    expect(state?.authorityPolicy).toBe('open')
  })
})
