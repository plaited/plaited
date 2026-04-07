import type { ModuleParams } from '../../agent.types.ts'

const FIXTURE_PING_EVENT = 'fixture_ping'
const FIXTURE_PONG_EVENT = 'fixture_pong'

const updateModulesFixture = ({ emit }: ModuleParams) => ({
  handlers: {
    [FIXTURE_PING_EVENT]() {
      emit({
        type: FIXTURE_PONG_EVENT,
        detail: { installed: true },
      })
    },
  },
})

export default [updateModulesFixture]
