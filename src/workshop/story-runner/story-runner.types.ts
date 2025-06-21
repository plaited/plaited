import type { BrowserContext } from 'playwright'
import type { StoryParams } from '../workshop.types.js'
import type { PlaitedFixtureSnapshotMessage } from './story-runner.schema.js'

export type LogMessageDetail = {
  colorScheme: ColorScheme
  context: BrowserContext
  snapshot: PlaitedFixtureSnapshotMessage
} & StoryParams

export type ColorScheme = 'light' | 'dark'
