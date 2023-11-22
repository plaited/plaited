import type { WebRenderer } from '@storybook/types'
import type { FunctionTemplate, PlaitedComponentConstructor } from '@plaited/component-types'

export type { RenderContext } from '@storybook/types'

export type StoryFnPlaitedReturnType = DocumentFragment

export interface ShowErrorArgs {
  title: string
  description: string
}

export interface PlaitedRender extends WebRenderer {
  component: FunctionTemplate | PlaitedComponentConstructor
  storyResult: StoryFnPlaitedReturnType
}

export type ExtractTemplateParameter<T> =
  T extends PlaitedComponentConstructor ? Parameters<T['template']>[0]
  : T extends FunctionTemplate ? Parameters<T>[0]
  : never
