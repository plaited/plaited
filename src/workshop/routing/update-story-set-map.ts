import { createStoryRoute } from './create-story-route.js'
import type { StorySet, StoryParams } from '../workshop.types.js'
import type { BrowserContextOptions } from 'playwright'
import { type Signal } from '../../behavioral/use-signal.js'

export const updateStorySetMap = ({
  filePath,
  storySet,
  recordVideoSignal,
  a11ySignal,
}: {
  filePath: string
  storySet: StorySet
  recordVideoSignal: Signal<BrowserContextOptions['recordVideo'] | undefined>
  a11ySignal: Signal<boolean>
}) => {
  const params: StoryParams[] = []
  for (const exportName in storySet) {
    const route = createStoryRoute({ filePath, exportName })
    const story = storySet[exportName]
    params.push({
      route,
      exportName,
      filePath,
      a11y: story?.parameters?.a11y ?? a11ySignal.get(),
      cookies: story?.parameters?.cookies,
      scale: story?.parameters?.scale,
      interaction: Boolean(story?.play),
      recordVideo: recordVideoSignal.get(),
    })
  }
  return params
}
