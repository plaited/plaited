import type { BrowserContext } from 'playwright'
import type { StoryParams } from '../story-server/story-server.types.js'

export type ColorScheme = 'light' | 'dark'

export type RunningMap = Map<
  string,
  StoryParams & {
    context: BrowserContext
  }
>
