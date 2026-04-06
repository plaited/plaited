import type { Factory } from '../../agent.ts'
import type { SnapshotMessage } from '../../behavioral.ts'
import { MODULE_DISCOVERY_FACTORY_EVENTS } from '../module-discovery-factory/module-discovery-factory.constants.ts'
import { PROJECTION_FACTORY_EVENTS } from '../projection-factory/projection-factory.constants.ts'
import { SEARCH_FACTORY_EVENTS } from '../search-factory/search-factory.constants.ts'
import { SKILLS_FACTORY_EVENTS } from '../skills-factory/skills-factory.constants.ts'
import { OBSERVABILITY_FACTORY_SIGNAL_KEYS } from './observability-factory.constants.ts'
import {
  type ObservabilityTraceEntry,
  ObservabilityTraceEntrySchema,
  ObservabilityTraceLogSchema,
} from './observability-factory.schemas.ts'
import type { CreateObservabilityFactoryOptions } from './observability-factory.types.ts'

/**
 * Creates the bounded observability factory.
 *
 * @public
 */
export const createObservabilityFactory =
  ({
    tracesSignalKey = OBSERVABILITY_FACTORY_SIGNAL_KEYS.traces,
    maxEntries = 50,
  }: CreateObservabilityFactoryOptions = {}): Factory =>
  ({ signals, useSnapshot }) => {
    const tracesSignal =
      signals.get(tracesSignalKey) ??
      signals.set({
        key: tracesSignalKey,
        schema: ObservabilityTraceLogSchema,
        value: [],
        readOnly: false,
      })

    const appendTrace = (entry: Omit<ObservabilityTraceEntry, 'timestamp'>) => {
      const next = ObservabilityTraceEntrySchema.parse({
        ...entry,
        timestamp: Date.now(),
      })
      const current = (tracesSignal.get() ?? []) as ObservabilityTraceEntry[]
      const updated = [...current, next].slice(-maxEntries)
      tracesSignal.set?.(updated)
    }

    useSnapshot((snapshot: SnapshotMessage) => {
      appendTrace({
        kind: snapshot.kind,
        sourceEvent: `snapshot:${snapshot.kind}`,
        summary: snapshot.kind === 'selection' ? 'Behavioral selection snapshot retained' : `Snapshot ${snapshot.kind}`,
      })
    })

    return {
      handlers: {
        [SKILLS_FACTORY_EVENTS.skills_factory_selected](detail) {
          appendTrace({
            kind: 'skill-selection',
            sourceEvent: SKILLS_FACTORY_EVENTS.skills_factory_selected,
            summary: `Selected skill ${(detail as { name?: string }).name ?? 'unknown'}`,
          })
        },
        [SEARCH_FACTORY_EVENTS.search_factory_results_updated](detail) {
          const { query, results } = detail as { query?: string; results?: unknown[] }
          appendTrace({
            kind: 'search-results',
            sourceEvent: SEARCH_FACTORY_EVENTS.search_factory_results_updated,
            summary: `Search '${query ?? 'unknown'}' produced ${results?.length ?? 0} results`,
          })
        },
        [MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_catalog_updated](detail) {
          appendTrace({
            kind: 'module-discovery',
            sourceEvent: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_catalog_updated,
            summary: `Module discovery retained ${(detail as { count?: number }).count ?? 0} candidates`,
          })
        },
        [PROJECTION_FACTORY_EVENTS.projection_factory_updated](detail) {
          appendTrace({
            kind: 'projection',
            sourceEvent: PROJECTION_FACTORY_EVENTS.projection_factory_updated,
            summary: `Projection updated with ${(detail as { count?: number }).count ?? 0} blocks`,
          })
        },
      },
    }
  }
