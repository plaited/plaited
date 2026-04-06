import type { Factory } from '../../agent.ts'
import { EDIT_FACTORY_SIGNAL_KEYS } from '../edit-factory/edit-factory.constants.ts'
import type { EditState } from '../edit-factory/edit-factory.schemas.ts'
import { MEMORY_FACTORY_SIGNAL_KEYS } from '../memory-factory/memory-factory.constants.ts'
import type { MemoryEpisode } from '../memory-factory/memory-factory.schemas.ts'
import { SESSION_PERSISTENCE_FACTORY_SIGNAL_KEYS } from '../session-persistence-factory/session-persistence-factory.constants.ts'
import type { SessionPersistenceState } from '../session-persistence-factory/session-persistence-factory.schemas.ts'
import { NODE_HOME_FACTORY_EVENTS, NODE_HOME_FACTORY_SIGNAL_KEYS } from './node-home-factory.constants.ts'
import {
  type NodeHomeArtifact,
  NodeHomeArtifactSchema,
  NodeHomeCheckpointDetailSchema,
  NodeHomeExportDetailSchema,
  NodeHomeHandoffDetailSchema,
  NodeHomeImportDetailSchema,
  NodeHomeRestoreDetailSchema,
  type NodeHomeState,
  NodeHomeStateSchema,
} from './node-home-factory.schemas.ts'
import type { CreateNodeHomeFactoryOptions } from './node-home-factory.types.ts'

const buildArtifacts = ({
  session,
  episodes,
  maxArtifacts,
}: {
  session: SessionPersistenceState | null
  episodes: MemoryEpisode[]
  maxArtifacts: number
}): NodeHomeArtifact[] => {
  const artifacts = [
    ...(session?.recentArtifacts ?? []).map((artifact) =>
      NodeHomeArtifactSchema.parse({
        kind: artifact.kind,
        summary: artifact.summary,
        timestamp: artifact.timestamp,
      }),
    ),
    ...episodes.slice(-2).map((episode) =>
      NodeHomeArtifactSchema.parse({
        kind: 'memory-episode',
        summary: episode.title,
        timestamp: episode.timestamp,
      }),
    ),
  ]

  const deduped = new Map<string, NodeHomeArtifact>()
  for (const artifact of artifacts) {
    deduped.set(`${artifact.kind}:${artifact.summary}`, artifact)
  }

  return [...deduped.values()].slice(-maxArtifacts)
}

const deriveStatus = ({
  currentStatus,
  edit,
}: {
  currentStatus: NodeHomeState['status']
  edit: EditState | null
}): NodeHomeState['status'] => {
  if (currentStatus === 'restoring') return 'restoring'
  if (!edit) return 'active'
  if (edit.status === 'proposed' || edit.status === 'applying' || edit.status === 'partial') {
    return 'checkpoint_pending'
  }
  if (edit.status === 'ready_for_verification') return 'handoff_ready'
  return 'active'
}

/**
 * Creates the bounded node-home policy factory.
 *
 * @public
 */
export const createNodeHomeFactory =
  ({
    stateSignalKey = NODE_HOME_FACTORY_SIGNAL_KEYS.state,
    sessionPersistenceSignalKey = SESSION_PERSISTENCE_FACTORY_SIGNAL_KEYS.state,
    memoryEpisodesSignalKey = MEMORY_FACTORY_SIGNAL_KEYS.episodes,
    editStateSignalKey = EDIT_FACTORY_SIGNAL_KEYS.state,
    maxArtifacts = 12,
    ownerHost = 'local',
  }: CreateNodeHomeFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: NodeHomeStateSchema,
        value: {
          ownerHost,
          status: 'active',
          durableArtifacts: [],
        },
        readOnly: false,
      })

    const publish = (next: NodeHomeState) => {
      const parsed = NodeHomeStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as NodeHomeState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: NODE_HOME_FACTORY_EVENTS.node_home_factory_updated,
        detail: {
          ownerHost: parsed.ownerHost,
          status: parsed.status,
          artifactCount: parsed.durableArtifacts.length,
        },
      })
    }

    const rebuildFromSignals = () => {
      const current = (stateSignal.get() ?? {
        ownerHost,
        status: 'active',
        durableArtifacts: [],
      }) as NodeHomeState
      const session = (signals.get(sessionPersistenceSignalKey)?.get() ?? null) as SessionPersistenceState | null
      const episodes = (signals.get(memoryEpisodesSignalKey)?.get() ?? []) as MemoryEpisode[]
      const edit = (signals.get(editStateSignalKey)?.get() ?? null) as EditState | null

      publish({
        ...current,
        status: deriveStatus({
          currentStatus: current.status,
          edit,
        }),
        durableArtifacts: buildArtifacts({
          session,
          episodes,
          maxArtifacts,
        }),
      })
    }

    signals.get(sessionPersistenceSignalKey)?.listen(() => rebuildFromSignals(), true)
    signals.get(memoryEpisodesSignalKey)?.listen(() => rebuildFromSignals(), true)
    signals.get(editStateSignalKey)?.listen(() => rebuildFromSignals(), true)
    rebuildFromSignals()

    return {
      handlers: {
        [NODE_HOME_FACTORY_EVENTS.node_home_factory_checkpoint](detail) {
          const parsed = NodeHomeCheckpointDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeHomeState | null
          if (!current) return
          publish({
            ...current,
            status: 'active',
            lastCheckpointAt: Date.now(),
            durableArtifacts: [
              ...current.durableArtifacts,
              NodeHomeArtifactSchema.parse({
                kind: 'checkpoint',
                summary: parsed.data.reason ?? 'Checkpoint created',
                timestamp: Date.now(),
              }),
            ].slice(-maxArtifacts),
          })
        },
        [NODE_HOME_FACTORY_EVENTS.node_home_factory_export](detail) {
          const parsed = NodeHomeExportDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeHomeState | null
          if (!current) return
          publish({
            ...current,
            status: 'active',
            lastPromotion: {
              mode: 'export',
              status: 'completed',
              targetHost: parsed.data.targetHost,
              bundleId: parsed.data.bundleId,
              timestamp: Date.now(),
            },
          })
        },
        [NODE_HOME_FACTORY_EVENTS.node_home_factory_import](detail) {
          const parsed = NodeHomeImportDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeHomeState | null
          if (!current) return
          publish({
            ...current,
            status: 'active',
            lastRestoredAt: Date.now(),
            lastPromotion: {
              mode: 'import',
              status: 'completed',
              sourceHost: parsed.data.sourceHost,
              bundleId: parsed.data.bundleId,
              timestamp: Date.now(),
            },
          })
        },
        [NODE_HOME_FACTORY_EVENTS.node_home_factory_handoff](detail) {
          const parsed = NodeHomeHandoffDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeHomeState | null
          if (!current) return
          publish({
            ...current,
            ownerHost: parsed.data.targetHost,
            status: 'active',
            lastPromotion: {
              mode: 'handoff',
              status: 'completed',
              targetHost: parsed.data.targetHost,
              bundleId: parsed.data.bundleId,
              timestamp: Date.now(),
            },
          })
        },
        [NODE_HOME_FACTORY_EVENTS.node_home_factory_restore](detail) {
          const parsed = NodeHomeRestoreDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as NodeHomeState | null
          if (!current) return
          publish({
            ...current,
            ownerHost: parsed.data.ownerHost ?? current.ownerHost,
            status: 'active',
            lastRestoredAt: Date.now(),
          })
        },
      },
    }
  }
