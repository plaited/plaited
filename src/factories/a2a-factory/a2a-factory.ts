import type { Factory } from '../../agent.ts'
import { IDENTITY_TRUST_FACTORY_SIGNAL_KEYS } from '../identity-trust-factory/identity-trust-factory.constants.ts'
import type { IdentityTrustState } from '../identity-trust-factory/identity-trust-factory.schemas.ts'
import { NODE_AUTH_FACTORY_SIGNAL_KEYS } from '../node-auth-factory/node-auth-factory.constants.ts'
import type { NodeAuthState } from '../node-auth-factory/node-auth-factory.schemas.ts'
import { NODE_DISCOVERY_FACTORY_SIGNAL_KEYS } from '../node-discovery-factory/node-discovery-factory.constants.ts'
import type { NodeDiscoveryState } from '../node-discovery-factory/node-discovery-factory.schemas.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../tool-registry-factory/tool-registry-factory.constants.ts'
import type { CapabilityRecord } from '../tool-registry-factory/tool-registry-factory.schemas.ts'
import { AgentCardSchema } from './a2a.schemas.ts'
import { A2A_FACTORY_EVENTS, A2A_FACTORY_SIGNAL_KEYS } from './a2a-factory.constants.ts'
import {
  type A2AFactoryState,
  A2AFactoryStateSchema,
  A2APeerRecordSchema,
  A2ATaskRecordSchema,
  CompleteA2ATaskDetailSchema,
  ReceiveA2AMessageDetailSchema,
  RegisterA2APeerDetailSchema,
} from './a2a-factory.policy.schemas.ts'
import type { CreateA2AFactoryOptions } from './a2a-factory.types.ts'

const toSkill = (record: CapabilityRecord) => ({
  id: record.id,
  name: record.name,
  description: record.description,
  tags: record.tags,
})

/**
 * Creates the bounded A2A policy factory.
 *
 * @public
 */
export const createA2AFactory =
  ({
    stateSignalKey = A2A_FACTORY_SIGNAL_KEYS.state,
    toolRegistrySignalKey = TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry,
    nodeDiscoverySignalKey = NODE_DISCOVERY_FACTORY_SIGNAL_KEYS.state,
    nodeAuthSignalKey = NODE_AUTH_FACTORY_SIGNAL_KEYS.state,
    identityTrustSignalKey = IDENTITY_TRUST_FACTORY_SIGNAL_KEYS.state,
    cardName = 'Plaited Node',
    maxTasks = 20,
  }: CreateA2AFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: A2AFactoryStateSchema,
        value: {
          card: AgentCardSchema.parse({
            name: cardName,
            url: 'https://local/.well-known/agent-card.json',
          }),
          peers: [],
          recentTasks: [],
        },
        readOnly: false,
      })

    const publish = (next: A2AFactoryState) => {
      const parsed = A2AFactoryStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as A2AFactoryState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: A2A_FACTORY_EVENTS.a2a_factory_updated,
        detail: {
          cardUrl: parsed.card.url,
          peerCount: parsed.peers.length,
          taskCount: parsed.recentTasks.length,
        },
      })
    }

    const rebuildCard = () => {
      const current = (stateSignal.get() ?? null) as A2AFactoryState | null
      if (!current) return
      const registry = (signals.get(toolRegistrySignalKey)?.get() ?? []) as CapabilityRecord[]
      const discovery = (signals.get(nodeDiscoverySignalKey)?.get() ?? null) as NodeDiscoveryState | null
      const auth = (signals.get(nodeAuthSignalKey)?.get() ?? null) as NodeAuthState | null
      const trust = (signals.get(identityTrustSignalKey)?.get() ?? null) as IdentityTrustState | null
      publish({
        ...current,
        card: AgentCardSchema.parse({
          name: cardName,
          url: discovery?.publicCardUrl ?? current.card.url,
          description: `Exposure ${auth?.exposureLevel ?? 'public'}`,
          capabilities: {
            streaming: true,
            pushNotifications: auth?.mode !== 'dev',
          },
          skills: registry.slice(0, 8).map(toSkill),
          supportsAuthenticatedExtendedCard: auth?.session !== null,
          additionalInterfaces: [
            {
              type: 'mss',
              url: discovery?.publicCardUrl ?? current.card.url,
              description: `Trusted peers: ${trust?.peers.length ?? 0}`,
            },
          ],
        }),
      })
    }

    signals.get(toolRegistrySignalKey)?.listen(() => rebuildCard(), true)
    signals.get(nodeDiscoverySignalKey)?.listen(() => rebuildCard(), true)
    signals.get(nodeAuthSignalKey)?.listen(() => rebuildCard(), true)
    signals.get(identityTrustSignalKey)?.listen(() => rebuildCard(), true)
    rebuildCard()

    return {
      handlers: {
        [A2A_FACTORY_EVENTS.a2a_factory_register_peer](detail) {
          const parsed = RegisterA2APeerDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as A2AFactoryState | null
          if (!current) return
          publish({
            ...current,
            peers: [
              ...current.peers.filter((peer) => peer.peerId !== parsed.data.peerId),
              A2APeerRecordSchema.parse(parsed.data),
            ],
          })
        },
        [A2A_FACTORY_EVENTS.a2a_factory_receive_message](detail) {
          const parsed = ReceiveA2AMessageDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as A2AFactoryState | null
          if (!current) return
          publish({
            ...current,
            recentTasks: [
              ...current.recentTasks,
              A2ATaskRecordSchema.parse({
                taskId: parsed.data.taskId,
                messageId: parsed.data.messageId,
                status: 'submitted',
                peerId: parsed.data.peerId,
              }),
            ].slice(-maxTasks),
          })
        },
        [A2A_FACTORY_EVENTS.a2a_factory_complete_task](detail) {
          const parsed = CompleteA2ATaskDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as A2AFactoryState | null
          if (!current) return
          publish({
            ...current,
            recentTasks: current.recentTasks.map((task) =>
              task.taskId === parsed.data.taskId ? A2ATaskRecordSchema.parse({ ...task, status: 'completed' }) : task,
            ),
          })
        },
      },
    }
  }
