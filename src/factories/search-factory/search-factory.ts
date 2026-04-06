import type { Factory } from '../../agent.ts'
import { MODULE_DISCOVERY_FACTORY_SIGNAL_KEYS } from '../module-discovery-factory/module-discovery-factory.constants.ts'
import type { FactoryModuleCatalogEntry } from '../module-discovery-factory/module-discovery-factory.schemas.ts'
import { SKILLS_FACTORY_SIGNAL_KEYS } from '../skills-factory/skills-factory.constants.ts'
import type { SkillCatalogEntry } from '../skills-factory/skills-factory.schemas.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../tool-registry-factory/tool-registry-factory.constants.ts'
import type { CapabilityRecord } from '../tool-registry-factory/tool-registry-factory.schemas.ts'
import { SEARCH_FACTORY_EVENTS, SEARCH_FACTORY_SIGNAL_KEYS } from './search-factory.constants.ts'
import { SearchRequestDetailSchema, SearchResultsSchema } from './search-factory.schemas.ts'
import type { CreateSearchFactoryOptions } from './search-factory.types.ts'
import { runSearch } from './search-factory.utils.ts'

/**
 * Creates the metadata-first search factory.
 *
 * @public
 */
export const createSearchFactory =
  ({
    rootDir = process.cwd(),
    resultsSignalKey = SEARCH_FACTORY_SIGNAL_KEYS.results,
    skillsCatalogSignalKey = SKILLS_FACTORY_SIGNAL_KEYS.catalog,
    moduleCatalogSignalKey = MODULE_DISCOVERY_FACTORY_SIGNAL_KEYS.catalog,
    toolRegistrySignalKey = TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry,
  }: CreateSearchFactoryOptions = {}): Factory =>
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
          type: SEARCH_FACTORY_EVENTS.search_factory_search_failed,
          detail: { reason: 'Invalid search payload' },
        })
        return
      }

      const skills = (signals.get(skillsCatalogSignalKey)?.get() ?? []) as SkillCatalogEntry[]
      const modules = (signals.get(moduleCatalogSignalKey)?.get() ?? []) as FactoryModuleCatalogEntry[]
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
        type: SEARCH_FACTORY_EVENTS.search_factory_results_updated,
        detail: payload,
      })
    }

    return {
      handlers: {
        [SEARCH_FACTORY_EVENTS.search_factory_search](detail) {
          void executeSearch(detail).catch((error) => {
            trigger({
              type: SEARCH_FACTORY_EVENTS.search_factory_search_failed,
              detail: { reason: error instanceof Error ? error.message : String(error) },
            })
          })
        },
      },
    }
  }
