
import { FunctionTemplate, } from '@plaited/jsx';
import { PlaitedComponentConstructor, createTemplateElement } from '@plaited/component';
import { dedent } from 'ts-dedent';
import type { RenderContext, ArgsStoryFn, PartialStoryFn, Args } from '@storybook/types';

import type { StoryFnPlaitedReturnType, PlaitedRender } from './types.js';

const isPlaitedComponent = (
  component: PlaitedComponentConstructor | FunctionTemplate
): component is PlaitedComponentConstructor => 'template' in component

export const render: ArgsStoryFn<PlaitedRender> = (args, context) => {
  const { id, component } = context;
  if (!component) {
    throw new Error(
      `Unable to render story ${id} as the component annotation is missing from the default export`
    );
  }
  const Component = isPlaitedComponent(component) ? component.template : component;
  const attrs = {}
  const events:{ [key: `on${string}`]: unknown; } = {}
  for(const arg in args) {
    if(arg.startsWith('on')) {
      events[arg] = args[arg]
    } else {
      attrs[arg] = args[arg]
    }
  }
  const { content, stylesheets } = Component(attrs)
  const style = stylesheets.size ? `<style>${[...stylesheets].join('')}</style>` : ''
  const frag = createTemplateElement(style + content).content
  for(const event in events) {
    frag.firstChild[event.toLowerCase()] = events[event]
  }
  return frag
};


const plaitedRender = (story: StoryFnPlaitedReturnType | null, canvasElement: Element) => {
  if(!story) return canvasElement.replaceChildren()
  canvasElement.replaceChildren(story)
}

const StoryHarness = ({
  showError,
  name,
  title,
  storyFn }:{
  name: string;
  title: string;
  showError: RenderContext<PlaitedRender>['showError'];
  storyFn: PartialStoryFn<PlaitedRender, Args>;
}) => {
  const content = storyFn()
  if (!(content instanceof DocumentFragment)) {
    showError({
      title: `Expecting a PlaitedComponent or FunctionalTemplate element from the story: "${name}" of "${title}".`,
      description: dedent`
        Did you forget to return the PlaitedComponent or FunctionalTemplate from the story?
        Use "() => (<MyComp/>)" or "() => { return <MyComp/>; }" when defining the story.
      `,
    });
    return null;
  }
  return content;
};

export const renderToCanvas = (
  { storyFn, title, name, showMain, showError, forceRemount }: RenderContext<PlaitedRender>,
  canvasElement: PlaitedRender['canvasElement']
) => {
  if (forceRemount) {
    plaitedRender(null, canvasElement);
  }

  showMain();

  const template =  StoryHarness({
    name:name,
    title:title,
    showError:showError,
    storyFn:storyFn,
  }) 

  plaitedRender(
    template,
    canvasElement
  );
}
