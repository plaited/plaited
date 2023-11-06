import type { WebRenderer } from '@storybook/types';
import type { PlaitedComponentConstructor } from '@plaited/component';
import type { FunctionTemplate, Template } from '@plaited/jsx';

export type { RenderContext } from '@storybook/types';

export type StoryFnPlaitedReturnType = Node;

export interface ShowErrorArgs {
  title: string;
  description: string;
}


export interface PlaitedRender extends WebRenderer {
  component: FunctionTemplate | PlaitedComponentConstructor;
  storyResult: StoryFnPlaitedReturnType;
}
