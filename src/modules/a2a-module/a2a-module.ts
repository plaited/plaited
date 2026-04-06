import type { Module } from '../../agent.ts'
import { IDENTITY_TRUST_MODULE_SIGNAL_KEYS } from '../identity-trust-module/identity-trust-module.constants.ts'
import type { IdentityTrustState } from '../identity-trust-module/identity-trust-module.schemas.ts'
import { NODE_AUTH_MODULE_SIGNAL_KEYS } from '../node-auth-module/node-auth-module.constants.ts'
import type { NodeAuthState } from '../node-auth-module/node-auth-module.schemas.ts'
import { NODE_DISCOVERY_MODULE_SIGNAL_KEYS } from '../node-discovery-module/node-discovery-module.constants.ts'
import type { NodeDiscoveryState } from '../node-discovery-module/node-discovery-module.schemas.ts'
import { TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from '../tool-registry-module/tool-registry-module.constants.ts'
import type { CapabilityRecord } from '../tool-registry-module/tool-registry-module.schemas.ts'
import { AgentCardSchema } from './a2a.schemas.ts'
import { A2A_MODULE_EVENTS, A2A_MODULE_SIGNAL_KEYS } from './a2a-module.constants.ts'
import {
  type A2AModuleState,
  A2AModuleStateSchema,
  A2APeerRecordSchema,
  A2ATaskRecordSchema,
  CompleteA2ATaskDetailSchema,
  ReceiveA2AMessageDetailSchema,
  RegisterA2APeerDetailSchema,
} from './a2a-module.policy.schemas.ts'
import type { CreateA2AModuleOptions } from './a2a-module.types.ts'

const toSkill = (record: CapabilityRecord) => ({
  id: record.id,
  name: record.name,
  description: record.description,
  tags: record.tags,
})

/**
 * Creates the bounded A2A policy module.
 *
 * @public
 */
export const createA2AModule =
  ({
    stateSignalKey = A2A_MODULE_SIGNAL_KEYS.state,
    toolRegistrySignalKey = TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
    nodeDiscoverySignalKey = NODE_DISCOVERY_MODULE_SIGNAL_KEYS.state,
    nodeAuthSignalKey = NODE_AUTH_MODULE_SIGNAL_KEYS.state,
    identityTrustSignalKey = IDENTITY_TRUST_MODULE_SIGNAL_KEYS.state,
    cardName = 'Plaited Node',
    maxTasks = 20,
  }: CreateA2AModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: A2AModuleStateSchema,
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

    const publish = (next: A2AModuleState) => {
      const parsed = A2AModuleStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as A2AModuleState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: A2A_MODULE_EVENTS.a2a_module_updated,
        detail: {
          cardUrl: parsed.card.url,
          peerCount: parsed.peers.length,
          taskCount: parsed.recentTasks.length,
        },
      })
    }

    const rebuildCard = () => {
      const current = (stateSignal.get() ?? null) as A2AModuleState | null
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
        [A2A_MODULE_EVENTS.a2a_module_register_peer](detail) {
          const parsed = RegisterA2APeerDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as A2AModuleState | null
          if (!current) return
          publish({
            ...current,
            peers: [
              ...current.peers.filter((peer) => peer.peerId !== parsed.data.peerId),
              A2APeerRecordSchema.parse(parsed.data),
            ],
          })
        },
        [A2A_MODULE_EVENTS.a2a_module_receive_message](detail) {
          const parsed = ReceiveA2AMessageDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as A2AModuleState | null
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
        [A2A_MODULE_EVENTS.a2a_module_complete_task](detail) {
          const parsed = CompleteA2ATaskDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as A2AModuleState | null
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
