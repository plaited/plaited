import type { Factory } from '../../agent.ts'
import { OBSERVABILITY_FACTORY_SIGNAL_KEYS } from '../observability-factory/observability-factory.constants.ts'
import type { ObservabilityTraceEntry } from '../observability-factory/observability-factory.schemas.ts'
import { PROJECTION_FACTORY_SIGNAL_KEYS } from '../projection-factory/projection-factory.constants.ts'
import type { ProjectionBlock } from '../projection-factory/projection-factory.schemas.ts'
import { MEMORY_FACTORY_EVENTS, MEMORY_FACTORY_SIGNAL_KEYS } from './memory-factory.constants.ts'
import {
  type MemoryEpisode,
  MemoryEpisodeSchema,
  MemoryEpisodesSchema,
  type MemoryObservation,
  MemoryObservationSchema,
  WorkingMemorySchema,
} from './memory-factory.schemas.ts'
import type { CreateMemoryFactoryOptions } from './memory-factory.types.ts'

const toObservation = ({ kind, summary }: { kind: string; summary: string }): MemoryObservation =>
  MemoryObservationSchema.parse({
    kind,
    summary,
    timestamp: Date.now(),
  })

/**
 * Creates the bounded memory factory.
 *
 * @public
 */
export const createMemoryFactory =
  ({
    workingSignalKey = MEMORY_FACTORY_SIGNAL_KEYS.working,
    episodesSignalKey = MEMORY_FACTORY_SIGNAL_KEYS.episodes,
    tracesSignalKey = OBSERVABILITY_FACTORY_SIGNAL_KEYS.traces,
    projectionBlocksSignalKey = PROJECTION_FACTORY_SIGNAL_KEYS.blocks,
    maxWorking = 8,
    observationBatchSize = 4,
  }: CreateMemoryFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const workingSignal =
      signals.get(workingSignalKey) ??
      signals.set({
        key: workingSignalKey,
        schema: WorkingMemorySchema,
        value: [],
        readOnly: false,
      })

    const episodesSignal =
      signals.get(episodesSignalKey) ??
      signals.set({
        key: episodesSignalKey,
        schema: MemoryEpisodesSchema,
        value: [],
        readOnly: false,
      })

    let lastTraceCount = 0
    let lastProjectionSignature = ''

    const appendObservation = (observation: MemoryObservation) => {
      const current = (workingSignal.get() ?? []) as MemoryObservation[]
      const updated = [...current, observation].slice(-maxWorking)
      workingSignal.set?.(updated)

      if (updated.length >= observationBatchSize) {
        const batch = updated.slice(-observationBatchSize)
        const episode = MemoryEpisodeSchema.parse({
          title: `Episode ${batch.at(-1)?.kind ?? 'memory'}`,
          observationKinds: batch.map((entry) => entry.kind),
          summary: batch.map((entry) => entry.summary).join(' | '),
          timestamp: Date.now(),
        })
        const episodes = (episodesSignal.get() ?? []) as MemoryEpisode[]
        episodesSignal.set?.([...episodes, episode].slice(-maxWorking))
      }

      trigger({
        type: MEMORY_FACTORY_EVENTS.memory_factory_updated,
        detail: {
          workingCount: updated.length,
          episodeCount: ((episodesSignal.get() ?? []) as MemoryEpisode[]).length,
        },
      })
    }

    signals.get(tracesSignalKey)?.listen(() => {
      const traces = (signals.get(tracesSignalKey)?.get() ?? []) as ObservabilityTraceEntry[]
      if (traces.length <= lastTraceCount) return
      const fresh = traces.slice(lastTraceCount)
      lastTraceCount = traces.length
      for (const trace of fresh) {
        appendObservation(
          toObservation({
            kind: trace.kind,
            summary: trace.summary,
          }),
        )
      }
    }, true)

    signals.get(projectionBlocksSignalKey)?.listen(() => {
      const blocks = (signals.get(projectionBlocksSignalKey)?.get() ?? []) as ProjectionBlock[]
      const signature = blocks.map((block) => `${block.id}:${block.body}`).join('|')
      if (!signature || signature === lastProjectionSignature) return
      lastProjectionSignature = signature
      appendObservation(
        toObservation({
          kind: 'projection',
          summary: `Projection updated with ${blocks.length} blocks`,
        }),
      )
    }, true)

    return {}
  }
