/** Glob pattern used to find story files within the project. */
export const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`
/** Regular expression used to filter files based on the story file naming convention. */
export const STORIES_FILTERS_REGEX = /\.stories.tsx?$/

/** The address identifier used for the main test runner communication channel. */
export const PLAITED_RUNNER = 'PLAITED_RUNNER'
/** Error type identifier when a play function exceeds its timeout duration. */
export const TIMEOUT_ERROR = 'TIMEOUT_ERROR'

/** Default timeout duration (in milliseconds) for story play functions. */
export const DEFAULT_PLAY_TIMEOUT = 5_000

export const OUTPUT_DIR = '/.plaited'
export const TESTING_OUTPUT_DIR = `${OUTPUT_DIR}/testing`
export const TRAINING_OUTPUT_DIR = `${OUTPUT_DIR}/training`
