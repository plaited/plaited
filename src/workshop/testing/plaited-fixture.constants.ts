import { keyMirror } from '../../utils/key-mirror.js'
import { FAILED_ASSERTION, MISSING_ASSERTION_PARAMETER } from './errors.js'
import { WAIT } from './use-wait.js'
import { ASSERT } from './use-assert.js'
import { FIND_BY_ATTRIBUTE } from './use-find-by-attribute.js'
import { FIND_BY_TEXT } from './use-find-by-text.js'
import { FIRE_EVENT } from './use-fire-event.js'

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000

export const FIXTURE_EVENTS = keyMirror(
  'PLAY',
  'FIXTURE_CONNECTED',
  'UNKNOWN_ERROR',
  'TEST_PASSED',
  'TEST_TIMEOUT',
  FAILED_ASSERTION,
  MISSING_ASSERTION_PARAMETER,
  WAIT,
  ASSERT,
  FIND_BY_ATTRIBUTE,
  FIND_BY_TEXT,
  FIRE_EVENT,
)

export const PLAITED_FIXTURE = 'plaited-test-fixture'

export const SCALE = keyMirror('1', '2', '3', '4', '5', '6', '7', '8', 'rel')
