import { createStoryRoute } from './create-story-route.js'
import { type StoryObj } from '../testing/assert.types.js'

export const getStorySet = async ({ entryPath, relativePath }: { entryPath: string; relativePath: string }) => {
  const { default: _, ...stories } = (await import(entryPath)) as {
    [key: string]: StoryObj
  }
  return new Set(
    Object.keys(stories).map((exportName) => ({
      exportName,
      route: createStoryRoute({ relativePath, exportName }),
      story: stories[exportName],
    })),
  )
}
