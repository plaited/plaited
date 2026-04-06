import { describe, expect, test } from 'bun:test'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import {
  MODULE_DISCOVERY_MODULE_EVENTS,
  MODULE_DISCOVERY_MODULE_SIGNAL_KEYS,
} from '../module-discovery-module.constants.ts'
import type { ModuleModuleCatalogSchema } from '../module-discovery-module.schemas.ts'
import { createModuleDiscoveryModule } from '../module-discovery-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createModuleDiscoveryModule', () => {
  test('discovers loadable module files and can load a selected module through update_modules', async () => {
    let catalogSignal: Signal<typeof ModuleModuleCatalogSchema> | undefined
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
      modules: [
        createModuleDiscoveryModule({
          rootDir: process.cwd(),
          patterns: ['src/modules/module-discovery-module/tests/*.module-module.ts'],
        }),
        ({ signals }) => {
          catalogSignal = signals.get(MODULE_DISCOVERY_MODULE_SIGNAL_KEYS.catalog) as Signal<
            typeof ModuleModuleCatalogSchema
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
      'src/modules/module-discovery-module/tests/module-discovery.fixture.module-module.ts',
    )
    expect(discovered?.[0]?.moduleCount).toBe(1)

    agent.trigger({
      type: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_load,
      detail: {
        path: 'src/modules/module-discovery-module/tests/module-discovery.fixture.module-module.ts',
      },
    })

    for (let attempt = 0; attempt < 10; attempt++) {
      agent.trigger({ type: 'module_discovery_fixture_ping' })
      await Bun.sleep(10)
    }

    await loadedSeen
  })
})
