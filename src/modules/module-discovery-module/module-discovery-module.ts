import type { Module } from '../../agent.ts'
import { AGENT_EVENTS } from '../../agent.ts'
import {
  MODULE_DISCOVERY_MODULE_EVENTS,
  MODULE_DISCOVERY_MODULE_SIGNAL_KEYS,
} from './module-discovery-module.constants.ts'
import {
  type ModuleModuleCatalogEntry,
  ModuleModuleCatalogSchema,
  LoadModuleModuleDetailSchema,
} from './module-discovery-module.schemas.ts'
import type { CreateModuleDiscoveryModuleOptions } from './module-discovery-module.types.ts'
import { discoverModuleModules } from './module-discovery-module.utils.ts'

/**
 * Creates the module discovery module.
 *
 * @public
 */
export const createModuleDiscoveryModule =
  ({
    rootDir = process.cwd(),
    patterns,
    catalogSignalKey = MODULE_DISCOVERY_MODULE_SIGNAL_KEYS.catalog,
  }: CreateModuleDiscoveryModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const catalogSignal =
      signals.get(catalogSignalKey) ??
      signals.set({
        key: catalogSignalKey,
        schema: ModuleModuleCatalogSchema,
        value: [],
        readOnly: false,
      })

    const reloadCatalog = async () => {
      const { catalog, errors } = await discoverModuleModules({
        rootDir,
        patterns,
      })
      catalogSignal.set?.(catalog)
      trigger({
        type: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_catalog_updated,
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
        type: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_catalog_failed,
        detail: {
          rootDir,
          message: error instanceof Error ? error.message : String(error),
        },
      })
    })

    return {
      handlers: {
        [MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_reload]() {
          void reloadCatalog().catch((error) => {
            trigger({
              type: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_catalog_failed,
              detail: {
                rootDir,
                message: error instanceof Error ? error.message : String(error),
              },
            })
          })
        },
        [MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_load](detail) {
          const parsed = LoadModuleModuleDetailSchema.safeParse(detail)
          if (!parsed.success) {
            trigger({
              type: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_load_failed,
              detail: { path: undefined, reason: 'Invalid module load payload' },
            })
            return
          }

          const catalog = (catalogSignal.get() ?? []) as ModuleModuleCatalogEntry[]
          const candidate = catalog.find((entry) => entry.path === parsed.data.path)
          if (!candidate) {
            trigger({
              type: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_load_failed,
              detail: { path: parsed.data.path, reason: 'Module not found in discovery catalog' },
            })
            return
          }

          trigger({
            type: AGENT_EVENTS.update_modules,
            detail: candidate.path,
          })
        },
      },
    }
  }
