import { keyMirror } from '../../utils/key-mirror.js'

export const TESTING_EVENTS = keyMirror('run_tests', 'log_event', 'end')

export const WORKSHOP_ROUTE = '/workshop.js'
export const RUNNER_URL = '/.plaited/test-runner'
export const RELOAD_STORY_PAGE = 'RELOAD_STORY_PAGE'

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000

export const PLAITED_FIXTURE = 'plaited-test-fixture'

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
