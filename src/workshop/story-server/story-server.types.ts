import type { StoryObj } from '../../testing.js'
import type { BrowserContextOptions } from 'playwright'

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
