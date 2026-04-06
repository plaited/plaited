import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import {
  MODULE_DISCOVERY_FACTORY_EVENTS,
  MODULE_DISCOVERY_FACTORY_SIGNAL_KEYS,
} from '../module-discovery-factory.constants.ts'
import type { FactoryModuleCatalogSchema } from '../module-discovery-factory.schemas.ts'
import { createModuleDiscoveryFactory } from '../module-discovery-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createModuleDiscoveryFactory', () => {
  test('discovers loadable module files and can load a selected module through update_factories', async () => {
    let catalogSignal: Signal<typeof FactoryModuleCatalogSchema> | undefined
    let resolveCatalog!: () => void
    let resolveLoaded!: () => void
    const catalogSeen = new Promise<void>((resolve) => {
      resolveCatalog = resolve
    })
    const loadedSeen = new Promise<void>((resolve) => {
      resolveLoaded = resolve
    })

    const agent = await createAgent({
      id: 'agent:module-discovery',
      cwd: process.cwd(),
      workspace: process.cwd(),
      models: TEST_MODELS,
      factories: [
        createModuleDiscoveryFactory({
          rootDir: process.cwd(),
          patterns: ['src/factories/module-discovery-factory/tests/*.factory-module.ts'],
        }),
        ({ signals }) => {
          catalogSignal = signals.get(MODULE_DISCOVERY_FACTORY_SIGNAL_KEYS.catalog) as Signal<
            typeof FactoryModuleCatalogSchema
          >
          catalogSignal.listen(() => resolveCatalog())

          return {
            handlers: {
              module_discovery_fixture_loaded() {
                resolveLoaded()
              },
            },
          }
        },
      ],
    })

    await catalogSeen

    const discovered = catalogSignal?.get()
    expect(discovered).toHaveLength(1)
    expect(discovered?.[0]?.path).toBe(
      'src/factories/module-discovery-factory/tests/module-discovery.fixture.factory-module.ts',
    )
    expect(discovered?.[0]?.factoryCount).toBe(1)

    agent.trigger({
      type: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_load,
      detail: {
        path: 'src/factories/module-discovery-factory/tests/module-discovery.fixture.factory-module.ts',
      },
    })

    for (let attempt = 0; attempt < 10; attempt++) {
      agent.trigger({ type: 'module_discovery_fixture_ping' })
      await Bun.sleep(10)
    }

    await loadedSeen
  })
})
