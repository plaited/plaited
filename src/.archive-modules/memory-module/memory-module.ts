import type { Module } from '../../agent.ts'
import { OBSERVABILITY_MODULE_SIGNAL_KEYS } from '../observability-module/observability-module.constants.ts'
import type { ObservabilityTraceEntry } from '../observability-module/observability-module.schemas.ts'
import { PROJECTION_MODULE_SIGNAL_KEYS } from '../projection-module/projection-module.constants.ts'
import type { ProjectionBlock } from '../projection-module/projection-module.schemas.ts'
import { MEMORY_MODULE_EVENTS, MEMORY_MODULE_SIGNAL_KEYS } from './memory-module.constants.ts'
import {
  type MemoryEpisode,
  MemoryEpisodeSchema,
  MemoryEpisodesSchema,
  type MemoryObservation,
  MemoryObservationSchema,
  WorkingMemorySchema,
} from './memory-module.schemas.ts'
import type { CreateMemoryModuleOptions } from './memory-module.types.ts'

const toObservation = ({ kind, summary }: { kind: string; summary: string }): MemoryObservation =>
  MemoryObservationSchema.parse({
    kind,
    summary,
    timestamp: Date.now(),
  })

/**
 * Creates the bounded memory module.
 *
 * @public
 */
export const createMemoryModule =
  ({
    workingSignalKey = MEMORY_MODULE_SIGNAL_KEYS.working,
    episodesSignalKey = MEMORY_MODULE_SIGNAL_KEYS.episodes,
    tracesSignalKey = OBSERVABILITY_MODULE_SIGNAL_KEYS.traces,
    projectionBlocksSignalKey = PROJECTION_MODULE_SIGNAL_KEYS.blocks,
    maxWorking = 8,
    observationBatchSize = 4,
  }: CreateMemoryModuleOptions = {}): Module =>
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
        type: MEMORY_MODULE_EVENTS.memory_module_updated,
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
