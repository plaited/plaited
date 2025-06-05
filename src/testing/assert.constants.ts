/** Error type identifier for failed assertions within a play function. */
export const ASSERTION_ERROR = 'ASSERTION_ERROR'
/** Error type identifier when required test parameters are missing. */
export const MISSING_TEST_PARAMS_ERROR = 'MISSING_TEST_PARAMS_ERROR'

/** Regular expression used to filter files based on the story file naming convention. */
export const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000
/** Event type used internally to trigger the execution of a story's play function. */
export const PLAY_EVENT = 'play'

/** Event type indicating that the test fixture element has connected to the DOM. */
export const FIXTURE_CONNECTED = 'FIXTURE_CONNECTED'
/** Error type identifier for unexpected or unknown errors during test execution. */
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR'
/** Error type identifier when a play function exceeds its timeout duration. */
export const TIMEOUT_ERROR = 'TIMEOUT_ERROR'
/** Event type indicating that a story test has passed successfully. */
export const TEST_PASSED = 'TEST_PASSED'
/** Event type indicating a test exception occurred (assertion, timeout, missing params). */
export const TEST_EXCEPTION = 'TEST_EXCEPTION'

/** The custom element tag name for the Plaited test fixture component. */
export const PLAITED_FIXTURE = 'plaited-test-fixture'
/** The address identifier used for the main test runner communication channel. */
export const PLAITED_RUNNER = 'PLAITED_RUNNER'
