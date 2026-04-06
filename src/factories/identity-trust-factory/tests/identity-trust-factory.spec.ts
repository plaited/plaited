import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { NODE_DISCOVERY_FACTORY_SIGNAL_KEYS } from '../../node-discovery-factory/node-discovery-factory.constants.ts'
import { NodeDiscoveryStateSchema } from '../../node-discovery-factory/node-discovery-factory.schemas.ts'
import { PERMISSION_AUDIT_FACTORY_SIGNAL_KEYS } from '../../permission-audit-factory/permission-audit-factory.constants.ts'
import { PermissionAuditLedgerSchema } from '../../permission-audit-factory/permission-audit-factory.schemas.ts'
import {
  IDENTITY_TRUST_FACTORY_EVENTS,
  IDENTITY_TRUST_FACTORY_SIGNAL_KEYS,
} from '../identity-trust-factory.constants.ts'
import type { IdentityTrustState, IdentityTrustStateSchema } from '../identity-trust-factory.schemas.ts'
import { createIdentityTrustFactory } from '../identity-trust-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createIdentityTrustFactory', () => {
  test('syncs local identity metadata and retains peer trust decisions', async () => {
    let stateSignal: Signal<typeof IdentityTrustStateSchema> | undefined

    const agent = await createAgent({
      id: 'agent:identity-trust',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        ({ signals }) => {
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
            key: PERMISSION_AUDIT_FACTORY_SIGNAL_KEYS.ledger,
            schema: PermissionAuditLedgerSchema,
            value: [
              {
                capabilityId: 'bash',
                decision: 'confirm_first',
                boundary: 'workspace',
                timestamp: 100,
              },
            ],
            readOnly: false,
          })
          return {}
        },
        createIdentityTrustFactory({ localIdentityId: 'identity:plaited' }),
        ({ signals }) => {
          stateSignal = signals.get(IDENTITY_TRUST_FACTORY_SIGNAL_KEYS.state) as Signal<typeof IdentityTrustStateSchema>
          return {}
        },
      ],
    })

    agent.trigger({
      type: IDENTITY_TRUST_FACTORY_EVENTS.identity_trust_factory_verify_peer,
      detail: {
        peerId: 'peer:remote',
        locator: 'https://remote/.well-known/agent-card.json',
        verificationMode: 'signed_card',
        claims: ['signed-card', 'workspace-access'],
        success: true,
      },
    })

    const state = stateSignal?.get() as IdentityTrustState | undefined
    expect(state?.localIdentityId).toBe('identity:plaited')
    expect(state?.discoveryNodeId).toBe('node:plaited')
    expect(state?.auditBoundaries).toEqual(['workspace'])
    expect(state?.peers[0]?.peerId).toBe('peer:remote')
    expect(state?.peers[0]?.trustLevel).toBe('trusted')
  })
})
