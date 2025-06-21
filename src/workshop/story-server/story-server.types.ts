import type { StoryObj } from '../story-fixture/story-fixture.types'
import type { BrowserContextOptions } from 'playwright'

export type StoryParams = {
  exportName: string
  route: string
  recordVideo?: BrowserContextOptions['recordVideo']
  filePath: string
}

export type StorySet = {
  [key: string]: StoryObj
}
