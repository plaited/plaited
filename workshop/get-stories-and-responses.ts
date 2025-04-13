import { getLibrary } from './get-library.js'
import { globStories } from './glob-stories.js'
import { mapStoryResponses } from './map-story-responses.js'
import { getStoryArtifacts } from './get-story-artifacts.js'
import { zip } from './zip.js'

export const getStoriesAndResponses = async (cwd: string, streamURL: `/${string}`) => {
  const responses: Map<string, Response> = new Map()
  const entries = await globStories(cwd)
  const { libraryImportMap, libraryArtifacts } = await getLibrary()
  const storyArtifacts = await getStoryArtifacts(cwd, entries)
  const artifacts = [...libraryArtifacts, ...storyArtifacts]
  for (const res of artifacts) {
    const path = res.path
    const content = await res.text()
    const formatedPath =
      path.startsWith('.') ? path.replace('.', '')
      : !path.startsWith('/') ? `/${path}`
      : path

    responses.set(formatedPath, zip(content))
  }
  const stories = await mapStoryResponses({ entries, responses, cwd, streamURL, libraryImportMap })
  return { stories, responses }
}
