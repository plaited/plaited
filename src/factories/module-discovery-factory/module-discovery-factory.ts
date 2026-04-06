import type { Factory } from '../../agent.ts'
import { AGENT_EVENTS } from '../../agent.ts'
import {
  MODULE_DISCOVERY_FACTORY_EVENTS,
  MODULE_DISCOVERY_FACTORY_SIGNAL_KEYS,
} from './module-discovery-factory.constants.ts'
import {
  type FactoryModuleCatalogEntry,
  FactoryModuleCatalogSchema,
  LoadFactoryModuleDetailSchema,
} from './module-discovery-factory.schemas.ts'
import type { CreateModuleDiscoveryFactoryOptions } from './module-discovery-factory.types.ts'
import { discoverFactoryModules } from './module-discovery-factory.utils.ts'

/**
 * Creates the module discovery factory.
 *
 * @public
 */
export const createModuleDiscoveryFactory =
  ({
    rootDir = process.cwd(),
    patterns,
    catalogSignalKey = MODULE_DISCOVERY_FACTORY_SIGNAL_KEYS.catalog,
  }: CreateModuleDiscoveryFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const catalogSignal =
      signals.get(catalogSignalKey) ??
      signals.set({
        key: catalogSignalKey,
        schema: FactoryModuleCatalogSchema,
        value: [],
        readOnly: false,
      })

    const reloadCatalog = async () => {
      const { catalog, errors } = await discoverFactoryModules({
        rootDir,
        patterns,
      })
      catalogSignal.set?.(catalog)
      trigger({
        type: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_catalog_updated,
        detail: {
          rootDir,
          count: catalog.length,
          modules: catalog,
          errors,
        },
      })
    }

    void reloadCatalog().catch((error) => {
      trigger({
        type: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_catalog_failed,
        detail: {
          rootDir,
          message: error instanceof Error ? error.message : String(error),
        },
      })
    })

    return {
      handlers: {
        [MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_reload]() {
          void reloadCatalog().catch((error) => {
            trigger({
              type: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_catalog_failed,
              detail: {
                rootDir,
                message: error instanceof Error ? error.message : String(error),
              },
            })
          })
        },
        [MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_load](detail) {
          const parsed = LoadFactoryModuleDetailSchema.safeParse(detail)
          if (!parsed.success) {
            trigger({
              type: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_load_failed,
              detail: { path: undefined, reason: 'Invalid module load payload' },
            })
            return
          }

          const catalog = (catalogSignal.get() ?? []) as FactoryModuleCatalogEntry[]
          const candidate = catalog.find((entry) => entry.path === parsed.data.path)
          if (!candidate) {
            trigger({
              type: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_load_failed,
              detail: { path: parsed.data.path, reason: 'Module not found in discovery catalog' },
            })
            return
          }

          trigger({
            type: AGENT_EVENTS.update_factories,
            detail: candidate.path,
          })
        },
      },
    }
  }
