import type { RenderContext, ArgsStoryFn, PartialStoryFn, Args, StoryContext } from '@storybook/types'

import type { StoryFnPlaitedReturnType, PlaitedRender } from './types.js'
import { createFragment, filterAttrs } from './utils.js'

export const render: ArgsStoryFn<PlaitedRender> = (args, context) => {
  const { id, component } = context
  if (!component) {
    throw new Error(`Unable to render story ${id} as the component annotation is missing from the default export`)
  }
  const { attrs } = filterAttrs(args)
  return component(attrs)
  // const frag = createFragment(
  // const element = frag.firstElementChild
  // if (!element) return frag
  // for (const event in events) {
  //   element && Object.assign(element, { [event]: events[event as `on${string}`] })
  // }
  // return frag
}

const plaitedRender = (story: DocumentFragment | null, canvasElement: Element) => {
  console.log(story)
  if (!story) return canvasElement.replaceChildren()
  canvasElement.replaceChildren(story)
}

const StoryHarness = ({
  showError,
  name,
  title,
  storyFn,
  storyContext,
}: {
  name: string
  title: string
  showError: RenderContext<PlaitedRender>['showError']
  storyFn: PartialStoryFn<PlaitedRender, Args>
  storyContext: StoryContext
}) => {
  const content = storyFn()
  const frag = createFragment(content)
  const { events } = filterAttrs(storyContext.args)
  const element = frag.firstElementChild
  for (const event in events) {
    element && Object.assign(element, { [event]: events[event as `on${string}`] })
  }
  if (!(frag instanceof DocumentFragment)) {
    showError({
      title: `Expecting a PlaitedComponent or FunctionalTemplate element from the story: "${name}" of "${title}".`,
      description: `
Did you forget to return the PlaitedComponent or FunctionalTemplate from the story?
Use "() => (<MyComp/>)" or "() => { return <MyComp/>; }" when defining the story.
`,
    })
    return null
  }
  return frag
}

export const renderToCanvas = (
  { storyFn, title, name, showMain, showError, forceRemount, storyContext }: RenderContext<PlaitedRender>,
  canvasElement: PlaitedRender['canvasElement'],
) => {
  if (forceRemount) {
    plaitedRender(null, canvasElement)
  }

  showMain()

  const template = StoryHarness({
    name: name,
    title: title,
    showError: showError,
    storyFn: storyFn,
    storyContext,
  })

  plaitedRender(template, canvasElement)
}
