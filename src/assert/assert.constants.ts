import { ACTION_TRIGGER } from '../client/client.constants.js'

export const ASSERTION_ERROR = 'ASSERTION_ERROR'
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR'
export const TIMEOUT_ERROR = 'TIMEOUT_ERROR'
export const MISSING_TEST_PARAMS_ERROR = 'MISSING_TEST_PARAMS_ERROR'
export const TEST_PASSED = 'TEST_PASSED'
export const TEST_EXCEPTION = 'TEST_EXCEPTION'
export const PRIMITIVES = new Set(['null', 'undefined', 'number', 'string', 'boolean', 'bigint'])

export const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`
export const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

export const DEFAULT_PLAY_TIMEOUT = 5_000
export const PLAY_EVENT = 'play'
export const PLAITED_FIXTURE = 'plaited-test-fixture'
export const PLAITED_ASSERT_ROUTE = 'plaited/assert'

export const RUN_PLAY_ACTION = {
  address: PLAITED_FIXTURE,
  action: ACTION_TRIGGER,
  type: PLAY_EVENT,
}
