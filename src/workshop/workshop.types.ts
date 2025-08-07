import type { StoryObj } from './story-fixture.types'
import type { BrowserContextOptions, BrowserContext } from 'playwright'

/**
 * @internal Defines the parameters required to identify and run a single story.
 * This includes its export name, route, video recording options, and original file path.
 */
export type StoryParams = {
  /** The name of the exported story object (e.g., `Primary`, `WithError`). */
  exportName: string
  /** The URL route generated for this story. */
  route: string
  /** Optional Playwright video recording configuration for this story. */
  recordVideo?: BrowserContextOptions['recordVideo']
  /** The file path where the story is defined. */
  filePath: string
}

/**
 * @internal Represents a collection of stories, typically from a single story file.
 * The keys are the export names of the stories, and the values are the `StoryObj` definitions.
 */
export type StorySet = {
  [key: string]: StoryObj
}

/** @internal Represents the supported color schemes for story rendering and testing. */
export type ColorScheme = 'light' | 'dark'

/**
 * @internal A Map used by the story runner to keep track of currently running story tests.
 * The key is a unique identifier for the test run (typically combining story path and color scheme),
 * and the value includes the story parameters along with its Playwright `BrowserContext`.
 */
export type RunningMap = Map<
  string,
  StoryParams & {
    context: BrowserContext
  }
>
