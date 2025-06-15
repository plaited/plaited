import { createStoryRoute } from './create-story-route.js'
import type { StorySet, TestParams } from '../workshop.types.js'
import type { BrowserContextOptions } from 'playwright'

export const updateTestMap = ({
  filePath,
  storySet,
  recordVideo,
  a11y = false,
}: {
  filePath: string
  storySet: StorySet
  recordVideo?: BrowserContextOptions['recordVideo']
  a11y?: boolean
}) => {
  const params: TestParams[] = []
  for (const exportName in storySet) {
    const route = createStoryRoute({ filePath, exportName })
    const story = storySet[exportName]
    params.push({
      route,
      exportName,
      filePath,
      a11y: a11y ?? story?.parameters?.a11y,
      headers: story?.parameters?.headers,
      scale: story?.parameters?.scale,
      interaction: Boolean(story?.play),
      recordVideo,
    })
  }
  return params
}
