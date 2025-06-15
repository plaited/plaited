import type { StoryObj, Params, A11yConfig } from './testing/plaited-fixture.types.js'
import { SCALE } from './testing/plaited-fixture.constants.js'
import type { BrowserContextOptions } from 'playwright'

/**
 * Represents the resolved test parameters used internally during test execution,
 * after merging story-specific parameters with defaults.
 * @internal
 */
export type TestParams = Omit<Params, 'styles' | 'a11y' | 'timeout'> & {
  exportName: string
  scale?: keyof typeof SCALE
  route: string
  interaction: boolean
  a11y?: boolean | A11yConfig
  recordVideo?: BrowserContextOptions['recordVideo']
  filePath: string
}
/**
 * @internal
 * A map of storyfile and TestParams
 */
export type TestMap = Map<string, TestParams[]>

export type StorySet = {
  [key: string]: StoryObj
}
