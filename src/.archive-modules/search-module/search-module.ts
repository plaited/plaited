import type { Module } from '../../agent.ts'
import { MODULE_DISCOVERY_MODULE_SIGNAL_KEYS } from '../module-discovery-module/module-discovery-module.constants.ts'
import type { ModuleModuleCatalogEntry } from '../module-discovery-module/module-discovery-module.schemas.ts'
import { SKILLS_MODULE_SIGNAL_KEYS } from '../skills-module/skills-module.constants.ts'
import type { SkillCatalogEntry } from '../skills-module/skills-module.schemas.ts'
import { TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from '../tool-registry-module/tool-registry-module.constants.ts'
import type { CapabilityRecord } from '../tool-registry-module/tool-registry-module.schemas.ts'
import { SEARCH_MODULE_EVENTS, SEARCH_MODULE_SIGNAL_KEYS } from './search-module.constants.ts'
import { SearchRequestDetailSchema, SearchResultsSchema } from './search-module.schemas.ts'
import type { CreateSearchModuleOptions } from './search-module.types.ts'
import { runSearch } from './search-module.utils.ts'

/**
 * Creates the metadata-first search module.
 *
 * @public
 */
export const createSearchModule =
  ({
    rootDir = process.cwd(),
    resultsSignalKey = SEARCH_MODULE_SIGNAL_KEYS.results,
    skillsCatalogSignalKey = SKILLS_MODULE_SIGNAL_KEYS.catalog,
    moduleCatalogSignalKey = MODULE_DISCOVERY_MODULE_SIGNAL_KEYS.catalog,
    toolRegistrySignalKey = TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
  }: CreateSearchModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const resultsSignal =
      signals.get(resultsSignalKey) ??
      signals.set({
        key: resultsSignalKey,
        schema: SearchResultsSchema.nullable(),
        value: null,
        readOnly: false,
      })

    const executeSearch = async (detail: unknown) => {
      const parsed = SearchRequestDetailSchema.safeParse(detail)
      if (!parsed.success) {
        trigger({
          type: SEARCH_MODULE_EVENTS.search_module_search_failed,
          detail: { reason: 'Invalid search payload' },
        })
        return
      }

      const skills = (signals.get(skillsCatalogSignalKey)?.get() ?? []) as SkillCatalogEntry[]
      const modules = (signals.get(moduleCatalogSignalKey)?.get() ?? []) as ModuleModuleCatalogEntry[]
      const tools = (signals.get(toolRegistrySignalKey)?.get() ?? []) as CapabilityRecord[]

      const search = await runSearch({
        query: parsed.data.query,
        searchClass: parsed.data.searchClass,
        limit: parsed.data.limit,
        rootDir,
        skills,
        modules,
        tools,
      })

      const payload = {
        query: parsed.data.query,
        searchClass: search.searchClass,
        results: search.results,
      }
      resultsSignal.set?.(payload)
      trigger({
        type: SEARCH_MODULE_EVENTS.search_module_results_updated,
        detail: payload,
      })
    }

    return {
      handlers: {
        [SEARCH_MODULE_EVENTS.search_module_search](detail) {
          void executeSearch(detail).catch((error) => {
            trigger({
              type: SEARCH_MODULE_EVENTS.search_module_search_failed,
              detail: { reason: error instanceof Error ? error.message : String(error) },
            })
          })
        },
      },
    }
  }
