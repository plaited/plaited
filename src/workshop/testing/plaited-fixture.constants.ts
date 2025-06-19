import { keyMirror } from '../../utils/key-mirror.js'
import { FAILED_ASSERTION, MISSING_ASSERTION_PARAMETER, ACCESSIBILITY_VIOLATION } from './errors.js'
import { WAIT } from './use-wait.js'
import { ASSERT } from './use-assert.js'
import { FIND_BY_ATTRIBUTE } from './use-find-by-attribute.js'
import { FIND_BY_TEXT } from './use-find-by-text.js'
import { FIRE_EVENT } from './use-fire-event.js'

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000

export const PLAITED_FIXTURE = 'plaited-test-fixture'

export const FIXTURE_EVENTS = keyMirror(
  ACCESSIBILITY_VIOLATION,
  ASSERT,
  FAILED_ASSERTION,
  FIND_BY_ATTRIBUTE,
  FIND_BY_TEXT,
  FIRE_EVENT,
  'FIXTURE_CONNECTED',
  MISSING_ASSERTION_PARAMETER,
  'PLAY',
  'RUN',
  'RUN_COMPLETE',
  'TEST_TIMEOUT',
  'UNKNOWN_ERROR',
  WAIT,
)

export const RUNNER_URL = '/.plaited/test-runner'
export const RELOAD_STORY_PAGE = 'RELOAD_STORY_PAGE'