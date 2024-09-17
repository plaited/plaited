import { Attrs, FunctionTemplate } from 'plaited'
import type { Play } from './use-play.js'

export type Parameters = {
  a11y?: Record<string, string> | false
  timeout?: number // Defaults to 5_000 ms
  cookies?: Record<string, string>
}

export type BaseStory = {
  parameters?: Parameters
}

export type PlayOnlyStory = {
  attrs?: never
  render?: never
  play: Play
} & BaseStory

export type TemplateStory<T extends Attrs = Attrs> = {
  attrs?: T
  render: FunctionTemplate<T>
  play?: Play
} & BaseStory

export type StoryObj<T extends Attrs = Attrs> = TemplateStory<T> | PlayOnlyStory

export type Handler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T,
) => Promise<Response>

export type MiddleWareHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T & { next: Handler },
) => Promise<Response>
