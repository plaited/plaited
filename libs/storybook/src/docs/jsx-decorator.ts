import type { PartialStoryFn, StoryContext } from '@storybook/types'
import { addons, useEffect } from '@storybook/preview-api'
import { SNIPPET_RENDERED, SourceType } from '@storybook/docs-tools'
import { createJSXString } from '../utils.js'
import type { PlaitedRender } from '../types.js'

function skipSourceRender(context: StoryContext<PlaitedRender>) {
  // We don't have a component name so skip render source
  if (!context.component?.name) return true
  // We are using the render function feature so skip render source
  if (context.moduleExport?.render) return true
  const sourceParams = context?.parameters.docs?.source
  const isArgsStory = context?.parameters.__isArgsStory
  if (sourceParams?.type === SourceType.DYNAMIC) return false

  // if we're providing code or it's not an args story we don't want to render source
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
    if (source) addons.getChannel().emit(SNIPPET_RENDERED, { id, source, args: unmappedArgs }) // Once the source is rendered, send it to the docs panel
  })
  if (!skipSourceRender(context) && name && args) {
    source = createJSXString(name, args)
  }
  return story
}
