import type { StoryObj, Params, A11yConfig } from './testing/plaited-fixture.types.js'
import { SCALE } from './testing/plaited-fixture.constants.js'
import type { BrowserContextOptions } from 'playwright'

export type StoryParams = Omit<Params, 'styles' | 'a11y' | 'timeout'> & {
  exportName: string
  scale?: keyof typeof SCALE
  route: string
  interaction: boolean
  a11y?: boolean | A11yConfig
  recordVideo?: BrowserContextOptions['recordVideo']
  filePath: string
}

export type StorySet = {
  [key: string]: StoryObj
}
