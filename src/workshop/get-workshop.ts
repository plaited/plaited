import { getLibrary } from './build-external-libraries.js'
import { globStories } from './glob-files.js'
import { mapStoryResponses } from './map-story-responses.js'
import { getStoryArtifacts } from './get-story-artifacts.js'
import { defaultGetHTMLResponse, type GetHTMLResponse } from './get-test-preview.js'

const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}

export const getWorkshop = async ({
  cwd,
  streamURL,
  getHTMLResponse = defaultGetHTMLResponse,
}: {
  cwd: string
  streamURL: `/${string}`
  getHTMLResponse?: GetHTMLResponse
}) => {
  const responses: Map<string, Response> = new Map()
  const entries = await globStories(cwd)
  const { libraryImportMap, libraryArtifacts } = await getLibrary()
  const storyArtifacts = await getStoryArtifacts(cwd, entries)
  const artifacts = [...libraryArtifacts, ...storyArtifacts]
  for (const res of artifacts) {
    const path = res.path
    const content = await res.text()
    const formattedPath =
      path.startsWith('.') ? path.replace('.', '')
      : !path.startsWith('/') ? `/${path}`
      : path

    responses.set(formattedPath, zip(content))
  }
  const stories = await mapStoryResponses({ entries, responses, cwd, streamURL, libraryImportMap, getHTMLResponse })
  return { stories, responses }
}
