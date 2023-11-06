import type {
  AnnotatedStoryFn,
  Args,
  ComponentAnnotations,
  StoryAnnotations,
  DecoratorFunction,
  LoaderFunction,
  StoryContext as GenericStoryContext,
  StrictArgs,
  ProjectAnnotations,
} from '@storybook/types';
import type { PlaitedRender } from './types.js';
import type { FunctionTemplate  } from '@plaited/jsx'
import { PlaitedComponentConstructor } from '@plaited/component'

export type { Args, ArgTypes, Parameters, StrictArgs } from '@storybook/types';
export type { PlaitedRender };

type ExtractTemplateParameter<T> = T extends PlaitedComponentConstructor
  ? Parameters<T['template']>[0]
  : T extends FunctionTemplate
  ? Parameters<T>[0]
  : never;

/**
 * Metadata to configure the stories for a component.
 *
 * @see [Default export](https://storybook.js.org/docs/formats/component-story-format/#default-export)
 */
export type Meta<T extends FunctionTemplate | PlaitedComponentConstructor = FunctionTemplate> = ComponentAnnotations<
  PlaitedRender,
  ExtractTemplateParameter<T>
>;

/**
 * Story function that represents a CSFv2 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryFn<T extends FunctionTemplate | PlaitedComponentConstructor = FunctionTemplate> = AnnotatedStoryFn<
  PlaitedRender,
  ExtractTemplateParameter<T>
>;

/**
 * Story function that represents a CSFv3 component example.
 *
 * @see [Named Story exports](https://storybook.js.org/docs/formats/component-story-format/#named-story-exports)
 */
export type StoryObj<T extends FunctionTemplate | PlaitedComponentConstructor = FunctionTemplate> = StoryAnnotations<
  PlaitedRender,
  ExtractTemplateParameter<T>
>;


export type Decorator<TArgs = StrictArgs> = DecoratorFunction<PlaitedRender, TArgs>;
export type Loader<TArgs = StrictArgs> = LoaderFunction<PlaitedRender, TArgs>;
export type StoryContext<TArgs = StrictArgs> = GenericStoryContext<PlaitedRender, TArgs>;
export type Preview = ProjectAnnotations<PlaitedRender>;
