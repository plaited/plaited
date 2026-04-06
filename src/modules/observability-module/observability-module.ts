import type { Module } from '../../agent.ts'
import type { SnapshotMessage } from '../../behavioral.ts'
import { MODULE_DISCOVERY_MODULE_EVENTS } from '../module-discovery-module/module-discovery-module.constants.ts'
import { PROJECTION_MODULE_EVENTS } from '../projection-module/projection-module.constants.ts'
import { SEARCH_MODULE_EVENTS } from '../search-module/search-module.constants.ts'
import { SKILLS_MODULE_EVENTS } from '../skills-module/skills-module.constants.ts'
import { OBSERVABILITY_MODULE_SIGNAL_KEYS } from './observability-module.constants.ts'
import {
  type ObservabilityTraceEntry,
  ObservabilityTraceEntrySchema,
  ObservabilityTraceLogSchema,
} from './observability-module.schemas.ts'
import type { CreateObservabilityModuleOptions } from './observability-module.types.ts'

/**
 * Creates the bounded observability module.
 *
 * @public
 */
export const createObservabilityModule =
  ({
    tracesSignalKey = OBSERVABILITY_MODULE_SIGNAL_KEYS.traces,
    maxEntries = 50,
  }: CreateObservabilityModuleOptions = {}): Module =>
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
        [SKILLS_MODULE_EVENTS.skills_module_selected](detail) {
          appendTrace({
            kind: 'skill-selection',
            sourceEvent: SKILLS_MODULE_EVENTS.skills_module_selected,
            summary: `Selected skill ${(detail as { name?: string }).name ?? 'unknown'}`,
          })
        },
        [SEARCH_MODULE_EVENTS.search_module_results_updated](detail) {
          const { query, results } = detail as { query?: string; results?: unknown[] }
          appendTrace({
            kind: 'search-results',
            sourceEvent: SEARCH_MODULE_EVENTS.search_module_results_updated,
            summary: `Search '${query ?? 'unknown'}' produced ${results?.length ?? 0} results`,
          })
        },
        [MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_catalog_updated](detail) {
          appendTrace({
            kind: 'module-discovery',
            sourceEvent: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_catalog_updated,
            summary: `Module discovery retained ${(detail as { count?: number }).count ?? 0} candidates`,
          })
        },
        [PROJECTION_MODULE_EVENTS.projection_module_updated](detail) {
          appendTrace({
            kind: 'projection',
            sourceEvent: PROJECTION_MODULE_EVENTS.projection_module_updated,
            summary: `Projection updated with ${(detail as { count?: number }).count ?? 0} blocks`,
          })
        },
      },
    }
  }
