import { keyMirror } from '../../utils.js'

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000

export const STORY_FIXTURE = 'palited-story-fixture'

export const RUNNER_URL = '/.plaited/test-runner'

export const RELOAD_STORY_PAGE = 'reload_story_page'

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
