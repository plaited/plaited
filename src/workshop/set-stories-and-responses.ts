import { type StoryObj, type TestParams } from '../testing/assert.types.js'
import { DEFAULT_PLAY_TIMEOUT } from '../testing/assert.constants.js'
import { createStoryRoute } from './create-story-route.js'
import { createTestPage } from './create-test-page.js'

export type CreateResponseParams = {
  entry: string
  cwd: string
  imports: Record<string, string>
  responses: Map<string, Response>
  stories: Map<string, TestParams>
  port: number
}

export const setStoriesAndResponses = async ({
  entry,
  cwd,
  imports,
  responses,
  stories,
  port,
}: CreateResponseParams) => {
  const { default: _, ...rest } = (await import(entry)) as {
    [key: string]: StoryObj
  }
  for (const exportName in rest) {
    const story = rest[exportName]
    const relativePath = entry.replace(new RegExp(`^${cwd}`), '')
    const route = createStoryRoute({ relativePath, exportName })
    createTestPage({
      story,
      route,
      responses,
      relativePath,
      exportName,
      imports,
      port,
    })
    stories.set(route, {
      a11y: story?.parameters?.a11y,
      description: story?.description,
      scale: story?.parameters?.scale,
      timeout: story?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT,
    })
  }
}
