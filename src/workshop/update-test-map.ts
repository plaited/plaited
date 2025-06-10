import { createStoryRoute } from './create-story-route.js'
import type { Stories, TestMap } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from './workshop.constants.js'

export const updateTestMap = async ({
  cwd,
  file,
  testMap,
  stories,
}: {
  cwd: string
  file: string
  stories: Stories
  testMap: TestMap
}) => {
  const filePath = file.replace(new RegExp(`^${cwd}`), '')
  testMap.set(filePath, [])
  for (const exportName in stories) {
    const route = createStoryRoute({ filePath, exportName })
    const story = stories[exportName]
    testMap.get(filePath)?.push({
      route,
      a11y: story?.parameters?.a11y,
      scale: story?.parameters?.scale,
      timeout: story?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT,
    })
  }
}
