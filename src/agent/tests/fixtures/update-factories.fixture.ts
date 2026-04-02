import type { FactoryParams } from '../../agent.types.ts'

const FIXTURE_PING_EVENT = 'fixture_ping'
const FIXTURE_PONG_EVENT = 'fixture_pong'

const updateFactoriesFixture = ({ trigger }: FactoryParams) => ({
  handlers: {
    [FIXTURE_PING_EVENT]() {
      trigger({
        type: FIXTURE_PONG_EVENT,
        detail: { installed: true },
      })
    },
  },
})

export default [updateFactoriesFixture]
