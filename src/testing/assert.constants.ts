/** Error type identifier for failed assertions within a play function. */
export const FAILED_ASSERTION = 'FAILED_ASSERTION'
/** Error type identifier when required assertiom parameters are missing. */
export const MISSING_ASSERTION_PARAMETER = 'MISSING_ASSERTION_PARAMETER'
/** Error type identifier for unexpected or unknown errors during test execution. */
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR'
/** Event fired when an interaction test successfully executes without error or assertion failures */
export const TEST_PASSED = 'TEST_PASSED'

/** Glob pattern used to find story files within the project. */
export const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`
/** Regular expression used to filter files based on the story file naming convention. */
export const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000
/** Event type used internally to trigger the execution of a story's play function. */
export const PLAY_EVENT = 'play'

/** Event type indicating that the test fixture element has connected to the DOM. */
export const FIXTURE_CONNECTED = 'FIXTURE_CONNECTED'

/** The custom element tag name for the Plaited test fixture component. */
export const PLAITED_FIXTURE = 'plaited-test-fixture'
/** The address identifier used for the main test runner communication channel. */
export const PLAITED_RUNNER = 'PLAITED_RUNNER'
