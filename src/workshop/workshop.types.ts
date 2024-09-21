import { Attrs, FunctionTemplate, PlaitedTemplate } from '../index.js'
import type { Play } from './use-play.js'

export type Parameters = {
  a11y?: Record<string, string> | false
  timeout?: number // Defaults to 5_000 ms
  cookies?: Record<string, string>
  style?: {
    stylesheet: string[];
  }
}

export type Meta<T extends Attrs = Attrs> = {
  args?: T
  parameters?: Parameters
  template?: FunctionTemplate<T> | PlaitedTemplate<T>
}

export type StoryObj<T extends Attrs | Meta = Attrs> = {
  args?: T extends Attrs ? T
  : T extends Meta ? T['args']
  : Attrs
  parameters?: Parameters
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
