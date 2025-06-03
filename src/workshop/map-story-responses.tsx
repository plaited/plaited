import { type StoryObj, type TestParams } from '../testing/assert.types.js'
import { createStoryRoute } from './create-story-route.js'
import { type GetHTMLResponse } from './get-test-preview.js'

export const mapStoryResponses = async ({
  entries,
  responses,
  cwd,
  streamURL,
  libraryImportMap,
  getHTMLResponse,
}: {
  entries: string[]
  responses: Map<string, Response>
  cwd: string
  streamURL: `/${string}`
  libraryImportMap: Record<string, string>
  getHTMLResponse: GetHTMLResponse
}) => {
  const routes: [string, TestParams][] = []
  await Promise.all(
    entries.map(async (entry) => {
      const { default: _, ...stories } = (await import(entry)) as {
        [key: string]: StoryObj
      }
      const storyFile = entry.replace(new RegExp(`^${cwd}`), '')
      for (const exportName in stories) {
        const route = createStoryRoute({ storyFile, exportName })
        const story = stories[exportName]
        const params = getHTMLResponse({
          story,
          route,
          responses,
          storyFile,
          exportName,
          streamURL,
          libraryImportMap,
        })
        routes.push([route, params])
      }
    }),
  )
  return routes
}
