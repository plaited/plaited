import type { StoryObj, Params } from './plaited-fixture.types.js'
import { SCALE } from './plaited-fixture.constants.js'

export type PageOptions = {
  output: string
  background?: `var(${string})`
  color?: `var(${string})`
  designTokens?: string
}

export type WorkshopParams = {
  cwd: string
  port?: number
} & Omit<PageOptions, 'output'>

/**
 * Represents the resolved test parameters used internally during test execution,
 * after merging story-specific parameters with defaults.
 * @internal
 */
export type TestParams = Omit<Params, 'styles'> & {
  timeout: number
  scale?: keyof typeof SCALE
  route: string
}

export type TestMap = Map<string, TestParams[]>

export type Stories = {
  [key: string]: StoryObj
}

export type TestRoutes = Record<string, () => Promise<Response>>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AssetRoutes = Record<string, any>
