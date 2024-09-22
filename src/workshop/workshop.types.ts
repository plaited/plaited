import type { Attrs, FunctionTemplate } from '../jsx/jsx.types.js'
import type { Play } from './use-play.js'

export type Params = {
  a11y?: Record<string, string> | false
  timeout?: number // Defaults to 5_000 ms
  cookies?: Record<string, string>
  style?: {
    stylesheet: string[]
  }
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
  template?: FunctionTemplate<T>
}

export type Handler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T,
) => Promise<Response>

export type MiddleWareHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T & { next: Handler },
) => Promise<Response>
