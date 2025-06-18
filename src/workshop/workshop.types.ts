import type { StoryObj } from './testing/plaited-fixture.types.js'
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
