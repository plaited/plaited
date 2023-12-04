import type { PartialStoryFn, StoryContext } from '@storybook/types'
import { addons, useEffect } from '@storybook/preview-api'
import { SNIPPET_RENDERED, SourceType } from '@storybook/docs-tools'
import { createJSXString, filterAttrs } from '@plaited/storybook-utils'
import type { PlaitedRender } from '../types.js'

function skipSourceRender(context: StoryContext<PlaitedRender>) {
  // We don't have a component name
  if (!context.component?.name) return true
  // We are using the render function feature
  if (context.originalStoryFn.length === 1) return true
  const sourceParams = context?.parameters.docs?.source
  const isArgsStory = context?.parameters.__isArgsStory
  if (sourceParams?.type === SourceType.DYNAMIC) return false
  // never render if the user is forcing the block to render code, or
  // if the user provides code, or if it's not an args story.
  return !isArgsStory || sourceParams?.code || sourceParams?.type === SourceType.CODE
}

export function jsxDecorator(
  storyFn: PartialStoryFn<PlaitedRender>,
  context: StoryContext<PlaitedRender>,
): PlaitedRender['storyResult'] {
  const story = storyFn()
  const name = context?.component?.name
  const args = context?.moduleExport?.args
  let source: string
  useEffect(() => {
    const { id, unmappedArgs } = context
    if (source) addons.getChannel().emit(SNIPPET_RENDERED, { id, source, args: unmappedArgs })
  })
  if (!skipSourceRender(context) && name && args) {
    source = createJSXString(name, args)
  }
  return story
}
