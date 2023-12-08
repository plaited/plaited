import type { RenderContext, ArgsStoryFn, PartialStoryFn, Args } from '@storybook/types'

import type { StoryFnPlaitedReturnType, PlaitedRender } from './types.js'

import { createFragment, filterAttrs, isPlaitedComponent } from '@plaited/storybook-utils'

export const render: ArgsStoryFn<PlaitedRender> = (args, context) => {
  const { id, component } = context
  if (!component) {
    throw new Error(`Unable to render story ${id} as the component annotation is missing from the default export`)
  }
  const Component = isPlaitedComponent(component) ? component.template : component
  const { attrs, events } = filterAttrs(args)
  const frag = createFragment(Component(attrs))
  const element = frag.firstElementChild
  if (!element) return frag
  for (const event in events) {
    element && Object.assign(element, { [event]: events[event as `on${string}`] })
  }
  return frag
}

const plaitedRender = (story: StoryFnPlaitedReturnType | null, canvasElement: Element) => {
  if (!story) return canvasElement.replaceChildren()
  canvasElement.replaceChildren(story)
}

const StoryHarness = ({
  showError,
  name,
  title,
  storyFn,
}: {
  name: string
  title: string
  showError: RenderContext<PlaitedRender>['showError']
  storyFn: PartialStoryFn<PlaitedRender, Args>
}) => {
  const content = storyFn()
  if (!(content instanceof DocumentFragment)) {
    showError({
      title: `Expecting a PlaitedComponent or FunctionalTemplate element from the story: "${name}" of "${title}".`,
      description: `
Did you forget to return the PlaitedComponent or FunctionalTemplate from the story?
Use "() => (<MyComp/>)" or "() => { return <MyComp/>; }" when defining the story.
`,
    })
    return null
  }
  return content
}

export const renderToCanvas = (
  { storyFn, title, name, showMain, showError, forceRemount }: RenderContext<PlaitedRender>,
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
  })

  plaitedRender(template, canvasElement)
}
