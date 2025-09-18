import type { BrowserContextOptions, BrowserContext } from 'playwright'

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
 * Map tracking active story tests with browser contexts.
 * Key: unique test identifier, Value: story params + context.
 */
export type RunningMap = Map<
  string,
  StoryParams & {
    context: BrowserContext
  }
>
