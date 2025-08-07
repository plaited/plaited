import type { BrowserContext } from 'playwright'
import type { StoryParams } from './story-server.types.js'

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
