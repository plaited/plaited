import type { BrowserContext } from 'playwright'
import type { PlaitedFixtureSnapshotMessage } from './story-runner.schema.js'
import type { StoryParams } from '../story-server/story-server.types.js'

export type LogMessageDetail = {
  colorScheme: ColorScheme
  context: BrowserContext
  snapshot: PlaitedFixtureSnapshotMessage
} & StoryParams

export type ColorScheme = 'light' | 'dark'
