import type { Factory } from '../../agent.ts'
import { NODE_HOME_FACTORY_SIGNAL_KEYS } from '../node-home-factory/node-home-factory.constants.ts'
import type { NodeHomeState } from '../node-home-factory/node-home-factory.schemas.ts'
import {
  NODE_DISCOVERY_FACTORY_EVENTS,
  NODE_DISCOVERY_FACTORY_SIGNAL_KEYS,
} from './node-discovery-factory.constants.ts'
import {
  BindDiscoveryTargetDetailSchema,
  type NodeDiscoveryState,
  NodeDiscoveryStateSchema,
  PublishDiscoveryDetailSchema,
} from './node-discovery-factory.schemas.ts'
import type { CreateNodeDiscoveryFactoryOptions } from './node-discovery-factory.types.ts'

const toPublicCardUrl = (ownerHost: string): string => `https://${ownerHost}/.well-known/agent-card.json`

/**
 * Creates the bounded node discovery factory.
 *
 * @public
 */
export const createNodeDiscoveryFactory =
  ({
    stateSignalKey = NODE_DISCOVERY_FACTORY_SIGNAL_KEYS.state,
    nodeHomeSignalKey = NODE_HOME_FACTORY_SIGNAL_KEYS.state,
    nodeId = 'node:local',
  }: CreateNodeDiscoveryFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: NodeDiscoveryStateSchema,
        value: {
          nodeId,
          ownerHost: 'local',
          publicCardUrl: toPublicCardUrl('local'),
          publicationStatus: 'idle',
        },
        readOnly: false,
      })

    let lastOwnerHost = ((stateSignal.get() ?? null) as NodeDiscoveryState | null)?.ownerHost ?? 'local'

    const publish = (next: NodeDiscoveryState) => {
      const parsed = NodeDiscoveryStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as NodeDiscoveryState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: NODE_DISCOVERY_FACTORY_EVENTS.node_discovery_factory_updated,
        detail: {
          nodeId: parsed.nodeId,
          ownerHost: parsed.ownerHost,
          publicationStatus: parsed.publicationStatus,
        },
      })
    }

    signals.get(nodeHomeSignalKey)?.listen(() => {
      const nodeHome = (signals.get(nodeHomeSignalKey)?.get() ?? null) as NodeHomeState | null
      if (!nodeHome) return
      const current = (stateSignal.get() ?? null) as NodeDiscoveryState | null
      if (!current) return
      const ownerHostChanged = nodeHome.ownerHost !== lastOwnerHost
      lastOwnerHost = nodeHome.ownerHost
      publish({
        ...current,
        ownerHost: nodeHome.ownerHost,
        publicCardUrl: toPublicCardUrl(nodeHome.ownerHost),
        publicationStatus: ownerHostChanged ? 'publish_required' : current.publicationStatus,
      })
    }, true)

    return {
      handlers: {
        [NODE_DISCOVERY_FACTORY_EVENTS.node_discovery_factory_bind_target](detail) {
          const parsed = BindDiscoveryTargetDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeDiscoveryState | null
          if (!current) return
          lastOwnerHost = parsed.data.ownerHost
          publish({
            ...current,
            ownerHost: parsed.data.ownerHost,
            publicCardUrl: parsed.data.publicCardUrl,
            privateExtensionUrl: parsed.data.privateExtensionUrl,
            publicationStatus: 'publish_required',
          })
        },
        [NODE_DISCOVERY_FACTORY_EVENTS.node_discovery_factory_publish](detail) {
          const parsed = PublishDiscoveryDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeDiscoveryState | null
          if (!current) return
          publish({
            ...current,
            publicationStatus: 'published',
            lastPublishedAt: parsed.data.timestamp ?? Date.now(),
          })
        },
      },
    }
  }
