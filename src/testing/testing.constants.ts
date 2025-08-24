import { keyMirror } from '../utils.js'

/**
 * Default timeout for story play functions.
 * @default 5000ms (5 seconds)
 */
export const DEFAULT_PLAY_TIMEOUT = 5_000

/**
 * @internal
 * Custom element tag for story test fixtures.
 */
export const STORY_FIXTURE = 'plaited-story-fixture'

/**
 * @internal
 * WebSocket endpoint for test runner communication.
 */
export const RUNNER_URL = '/.plaited/test-runner'

/**
 * @internal
 * Command to reload story page during testing.
 */
export const RELOAD_STORY_PAGE = 'reload_story_page'

/**
 * @internal
 * Event types for test fixture communication.
 * Used between story fixture and test runner.
 */
export const FIXTURE_EVENTS = keyMirror(
  'accessibility_check',
  'accessibility_violation',
  'assert',
  'failed_assertion',
  'find_by_attribute',
  'find_by_text',
  'fire_event',
  'fixture_connected',
  'missing_assertion_parameter',
  'play',
  'run',
  'run_complete',
  'test_timeout',
  'unknown_error',
  'wait',
)
