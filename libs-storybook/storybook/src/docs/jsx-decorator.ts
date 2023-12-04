import type { ArgsStoryFn, PartialStoryFn, StoryContext } from '@storybook/types';
import { addons, useEffect } from '@storybook/preview-api';
import { SNIPPET_RENDERED, SourceType } from '@storybook/docs-tools';

import type { PlaitedRender } from '../types.js';


function skipSourceRender(context: StoryContext<PlaitedRender>) {
  const sourceParams = context?.parameters.docs?.source;
  const isArgsStory = context?.parameters.__isArgsStory;

  // always render if the user forces it
  if (sourceParams?.type === SourceType.DYNAMIC) {
    return false;
  }

  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE;
}

export function sourceDecorator(
  storyFn: PartialStoryFn<PlaitedRender>,
  context: StoryContext<PlaitedRender>
): PlaitedRender['storyResult'] {
  const story = storyFn();
  const renderedForSource = context?.parameters.docs?.source?.excludeDecorators
    ? (context.originalStoryFn as ArgsStoryFn<PlaitedRender>)(context.args, context)
    : story;

  let source: string;

  useEffect(() => {
    const { id, unmappedArgs } = context;
    if (source) addons.getChannel().emit(SNIPPET_RENDERED, { id, source, args: unmappedArgs });
  });
  console.log(context)
  if (!skipSourceRender(context)) {
    const container = window.document.createElement('div');
    if (renderedForSource instanceof DocumentFragment) {
      // console.log({ renderedForSource: serializer.serializeToString(renderedForSource) });
      // render(renderedForSource.cloneNode(true), container);
      container.append(renderedForSource.cloneNode(true));
    } else {
      // console.log({ renderedForSource: serializer.serializeToString(renderedForSource) });
      // render(renderedForSource, container);
      container.append(renderedForSource);
    }
    source = container.innerHTML;
  }

  return story;
}
