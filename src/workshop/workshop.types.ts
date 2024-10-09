import type { Attrs, FunctionTemplate } from '../jsx/jsx.types.ts'
import type { Play } from './use-play.tsx'
import type { StylesObject } from '../css/css.types.ts'

export type Scale = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'rel'

export type Params = {
  a11y?: Record<string, string> | false
  description?: string
  headers?: (env: NodeJS.ProcessEnv) => Headers
  scale?: Scale
  styles?: StylesObject
  timeout?: number // Defaults to 5_000 ms
}

export type Meta<T extends FunctionTemplate = FunctionTemplate> = {
  args?: Parameters<T>[0]
  parameters?: Params
  template?: T
}

export type StoryObj<T extends FunctionTemplate | Meta = Meta> = {
  args?: T extends FunctionTemplate ? Parameters<T>[0]
  : T extends Meta ? T['args']
  : Attrs
  parameters?: Params
  play?: Play
  template?: T extends FunctionTemplate ? T
  : T extends Meta ? T['template']
  : FunctionTemplate
}

export type TestParams = {
  a11y?: false | Record<string, string>
  description?: string
  scale?: Scale
  timeout: number
}
