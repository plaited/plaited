import { mapStoryResponses } from './map-story-responses.js'
import { STORY_GLOB_PATTERN } from './workshop.constants.js'

export const globStories = async (cwd: string) => {
  const glob = new Bun.Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

export const getStories = async ({
  cwd,
  streamURL,
  imports,
}: {
  cwd: string
  streamURL: `/${string}`
  imports: Record<string, string>
}) => {
  const storyEntries = await globStories(cwd)
  const responses: Map<string, Response> = new Map()
  const stories = await mapStoryResponses({ storyEntries, responses, cwd, streamURL, imports })
  return { stories, responses }
}
