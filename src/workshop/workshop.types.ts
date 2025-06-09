import type { Attrs, TemplateObject } from '../jsx/jsx.types.js'
import type { StoryObj, Params } from './plaited-fixture.types.js'
import { SCALE } from './plaited-fixture.constants.js'

export type CreateStory = <T extends Attrs = Attrs>(
  args: StoryObj<T>,
) => {
  template: TemplateObject
  params: Params
}

/**
 * Represents the resolved test parameters used internally during test execution,
 * after merging story-specific parameters with defaults.
 * @internal
 */
export type TestParams = {
  a11y?: false | Record<string, string>
  scale?: typeof SCALE
  timeout: number
}

export type PageOptions = {
  output: string
  background?: `var(${string})`
  color?: `var(${string})`
  designTokens?: string
}

export type WorkshopParams = {
  cwd: string
  port?: number
} & PageOptions
