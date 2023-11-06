import type { WebRenderer } from '@storybook/types';
import type { PlaitedComponentConstructor } from '@plaited/component';
import type { FunctionTemplate } from '@plaited/jsx';

export type { RenderContext } from '@storybook/types';

export type StoryFnPlaitedReturnType = DocumentFragment;

export interface ShowErrorArgs {
  title: string;
  description: string;
}


export interface PlaitedRender extends WebRenderer {
  component: FunctionTemplate | PlaitedComponentConstructor;
  storyResult: StoryFnPlaitedReturnType;
}
