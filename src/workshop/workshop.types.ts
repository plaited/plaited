import type { Scale } from '../testing/assert.types.js'

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

/**
 * Represents the resolved test parameters used internally during test execution,
 * after merging story-specific parameters with defaults.
 * @internal
 */
export type TestParams = {
  a11y?: false | Record<string, string>
  scale?: Scale
  timeout: number
}
