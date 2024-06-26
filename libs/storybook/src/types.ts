import type { WebRenderer } from '@storybook/types'
import type { FunctionTemplate, PlaitedTemplate, TemplateObject } from 'plaited'

export type { RenderContext } from '@storybook/types'

export type StoryFnPlaitedReturnType = TemplateObject

export interface ShowErrorArgs {
  title: string
  description: string
}

export interface PlaitedRender extends WebRenderer {
  component: FunctionTemplate | PlaitedTemplate
  storyResult: StoryFnPlaitedReturnType
}

export type ExtractTemplateParameter<T> = T extends FunctionTemplate ? Parameters<T>[0] : never
