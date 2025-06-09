import { keyMirror } from '../utils/key-mirror.js'

export const PLAITED_FIXTURE = 'plaited-test-fixture'
/** Event type used internally to trigger the execution of a story's play function. */
export const PLAY_EVENT = 'play'
/** Event type indicating that the test fixture element has connected to the DOM. */
export const FIXTURE_CONNECTED = 'FIXTURE_CONNECTED'
/** Error type identifier for unexpected or unknown errors during test execution. */
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR'
/** Event type indicating that a story test has passed successfully. */
export const TEST_PASSED = 'TEST_PASSED'

export const SCALE = keyMirror('1', '2', '3', '4', '5', '6', '7', '8', 'rel')

export const STORY_USAGE = keyMirror('test', 'doc', 'train')
