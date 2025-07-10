import { keyMirror } from '../../utils.js'

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000

/** @internal The custom element tag name for the story fixture component. */
export const STORY_FIXTURE = 'palited-story-fixture'

/** @internal URL path for the test runner iframe. */
export const RUNNER_URL = '/.plaited/test-runner'

/** @internal Event name or command identifier to trigger a reload of the story page. */
export const RELOAD_STORY_PAGE = 'reload_story_page'

/**
 * @internal Key-mirrored object of event names used for communication
 * between the story fixture and the test runner or other parts of the workshop system.
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
