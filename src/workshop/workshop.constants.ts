export const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`
export const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

export const DEFAULT_PLAY_TIMEOUT = 5_000
export const PLAY_EVENT = 'play'
export const PLAITED_FIXTURE = 'plaited-test-fixture'
export const PLAITED_ASSERT_ROUTE = 'plaited/assert'
export const PLAITED_RUNNER = 'PLAITED_RUNNER'

export const RUN_PLAY_ACTION = {
  address: PLAITED_FIXTURE,
  type: PLAY_EVENT,
}

export const FIXTURE_CONNECTED = 'FIXTURE_CONNECTED'
