import type { BrowserContext, BrowserContextOptions } from 'playwright'
import type { PlaitedFixtureSnapshotMessage } from './story-runner.schema.js'

export type StoryParams = {
  exportName: string
  route: string
  recordVideo?: BrowserContextOptions['recordVideo']
  filePath: string
}

export type LogMessageDetail = {
  colorScheme: ColorScheme
  context: BrowserContext
  snapshot: PlaitedFixtureSnapshotMessage
} & StoryParams

export type ColorScheme = 'light' | 'dark'
