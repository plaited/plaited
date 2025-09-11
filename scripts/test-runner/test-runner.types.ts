import type { BrowserContext } from 'playwright'
import type { StoryParams } from './test-server.types.js'

/**
 * @internal
 * Supported color schemes for story testing.
 */
export type ColorScheme = 'light' | 'dark'

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
