import { Attrs, FunctionTemplate } from '../jsx/jsx.types.js'
import type { Play } from './use-play.js'

export type Parameters = {
  a11y?: {
    [key: string]: {
      enabled: boolean
    }
  }
  timeout?: number // Defaults to 5_000 ms
}

export type BaseStory = {
  play?: Play
  parameters?: Parameters
}

export type ModuleStory = {
  attrs?: never
  location: string
  render?: never
  searchParams: URLSearchParams
} & BaseStory

export type TemplateStory<T extends Attrs = Attrs> = {
  attrs?: T
  location?: never
  render: FunctionTemplate<T>
  searchParams?: never
} & BaseStory

export type StoryObj<T extends Attrs = Attrs> = TemplateStory<T> | ModuleStory
