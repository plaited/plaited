import { keyMirror } from '../utils.ts'

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
export const RUNNER_URL = '/.plaited/runner'

/**
 * @internal
 * Command to reload story page during testing.
 */
export const RELOAD_PAGE = 'reload_page'

export const DATA_TESTID = 'data-testid'

/**
 * @internal
 * Event types for test fixture communication.
 * Used between story fixture and test runner.
 */
export const FIXTURE_EVENTS = keyMirror(
  'accessibility_check',
  'assertion',
  'find_by_attribute',
  'find_by_target',
  'find_by_test_id',
  'find_by_text',
  'fire_event',
  'play',
  'run',
  'test_fail',
  'test_pass',
  'wait',
)

export const ERROR_TYPES = keyMirror(
  'accessibility_violation',
  'failed_assertion',
  'missing_assertion_parameter',
  'test_timeout',
  'unknown_error',
)

export const SUCCESS_TYPES = keyMirror('passed_assertion', 'passed_accessibility_check')

export const __PLAITED_RUNNER__ = '__PLAITED_RUNNER__'
export const __PLAITED__ = '__PLAITED__'

export const STORY_TYPES = keyMirror('snapshot', 'interaction')

export const STORY_IDENTIFIER = '🍬'

/**
 * @internal
 * Event types for mask and header communication.
 */
export const MASK_EVENTS = keyMirror('emit_click', 'toggle')

export const HEADER_EVENTS = keyMirror('emit_toggle', 'toggle')
