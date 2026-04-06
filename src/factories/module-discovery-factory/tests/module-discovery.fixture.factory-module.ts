import type { FactoryParams } from '../../../agent.ts'

const MODULE_DISCOVERY_FIXTURE_EVENT = 'module_discovery_fixture_ping'
const MODULE_DISCOVERY_FIXTURE_LOADED_EVENT = 'module_discovery_fixture_loaded'

const moduleDiscoveryFixture = ({ trigger }: FactoryParams) => ({
  handlers: {
    [MODULE_DISCOVERY_FIXTURE_EVENT]() {
      trigger({
        type: MODULE_DISCOVERY_FIXTURE_LOADED_EVENT,
        detail: { loaded: true },
      })
    },
  },
})

export default [moduleDiscoveryFixture]
