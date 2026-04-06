import type { Factory } from '../../agent.ts'
import { MEMORY_FACTORY_SIGNAL_KEYS } from '../memory-factory/memory-factory.constants.ts'
import type { MemoryObservation } from '../memory-factory/memory-factory.schemas.ts'
import { OBSERVABILITY_FACTORY_SIGNAL_KEYS } from '../observability-factory/observability-factory.constants.ts'
import type { ObservabilityTraceEntry } from '../observability-factory/observability-factory.schemas.ts'
import {
  SESSION_PERSISTENCE_FACTORY_EVENTS,
  SESSION_PERSISTENCE_FACTORY_SIGNAL_KEYS,
} from './session-persistence-factory.constants.ts'
import {
  type SessionArtifact,
  SessionArtifactSchema,
  type SessionPersistenceState,
  SessionPersistenceStateSchema,
} from './session-persistence-factory.schemas.ts'
import type { CreateSessionPersistenceFactoryOptions } from './session-persistence-factory.types.ts'

/**
 * Creates the bounded session persistence factory.
 *
 * @public
 */
export const createSessionPersistenceFactory =
  ({
    stateSignalKey = SESSION_PERSISTENCE_FACTORY_SIGNAL_KEYS.state,
    workingMemorySignalKey = MEMORY_FACTORY_SIGNAL_KEYS.working,
    tracesSignalKey = OBSERVABILITY_FACTORY_SIGNAL_KEYS.traces,
    maxArtifacts = 10,
  }: CreateSessionPersistenceFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: SessionPersistenceStateSchema,
        value: {
          recentArtifacts: [],
        },
        readOnly: false,
      })

    let lastTraceCount = 0
    let lastWorkingCount = 0

    const appendArtifact = (artifact: SessionArtifact) => {
      const current = (stateSignal.get() ?? { recentArtifacts: [] }) as SessionPersistenceState
      const recentArtifacts = [...current.recentArtifacts, artifact].slice(-maxArtifacts)
      stateSignal.set?.({
        ...current,
        recentArtifacts,
      })
      trigger({
        type: SESSION_PERSISTENCE_FACTORY_EVENTS.session_persistence_factory_updated,
        detail: {
          artifactCount: recentArtifacts.length,
        },
      })
    }

    signals.get(tracesSignalKey)?.listen(() => {
      const traces = (signals.get(tracesSignalKey)?.get() ?? []) as ObservabilityTraceEntry[]
      if (traces.length <= lastTraceCount) return
      const fresh = traces.slice(lastTraceCount)
      lastTraceCount = traces.length
      for (const trace of fresh.slice(-2)) {
        appendArtifact(
          SessionArtifactSchema.parse({
            kind: trace.kind,
            summary: trace.summary,
            timestamp: trace.timestamp,
          }),
        )
      }
    }, true)

    signals.get(workingMemorySignalKey)?.listen(() => {
      const working = (signals.get(workingMemorySignalKey)?.get() ?? []) as MemoryObservation[]
      if (working.length <= lastWorkingCount) return
      lastWorkingCount = working.length
      const latest = working.at(-1)
      if (!latest) return
      appendArtifact(
        SessionArtifactSchema.parse({
          kind: `memory:${latest.kind}`,
          summary: latest.summary,
          timestamp: latest.timestamp,
        }),
      )
    }, true)

    return {}
  }
