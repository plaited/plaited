import type { StoryMetadata } from './workshop.types.js'

/**
 * Input configuration for testing stories.
 */
export type TestStoriesInput = {
  /** Array of story parameters to test */
  storiesMetaData: StoryMetadata[]
  /** Whether to test in both light and dark color schemes */
  colorSchemeSupport?: boolean
  /** Host name of the currently running test server */
  hostName: string | URL
}

/**
 * Metadata for a test result.
 */
export type TestResultMeta = {
  /** Full URL to the story */
  url: string
  /** File path to the story file */
  filePath: string
  /** Name of the exported story */
  exportName: string
  /** Color scheme used for testing */
  colorScheme: 'light' | 'dark'
}

/**
 * Result from testing a single story.
 */
export type TestResult = {
  /** Test result details */
  detail: unknown
  /** Test metadata */
  meta: TestResultMeta
}

/**
 * Output from running story tests.
 */
export type TestStoriesOutput = {
  /** Array of passed test results */
  passed: TestResult[]
  /** Array of failed test results */
  failed: TestResult[]
}
