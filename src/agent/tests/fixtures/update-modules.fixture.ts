const FIXTURE_PING_EVENT = 'fixture_ping'
const FIXTURE_PONG_EVENT = 'fixture_pong'

const updateModulesFixture = ({ emit }: { emit: (event: { type: string; detail?: unknown }) => void }) => ({
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
