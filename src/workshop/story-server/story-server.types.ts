import type { StoryObj } from '../../testing.js'
import type { BrowserContextOptions } from 'playwright'

/**
 * @internal
 * Story test parameters including route and recording options.
 */
export type StoryParams = {
  /** Exported story name (e.g., `Primary`, `WithError`) */
  exportName: string
  /** Generated URL route */
  route: string
  /** Playwright video recording config */
  recordVideo?: BrowserContextOptions['recordVideo']
  /** Source file path */
  filePath: string
}

/**
 * @internal
 * Story collection from a single file.
 * Maps export names to story definitions.
 */
export type StorySet = {
  [key: string]: StoryObj
}
