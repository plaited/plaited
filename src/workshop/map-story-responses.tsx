import path from 'path'
import { ssr } from '../jsx/ssr.js'
import {
  STORIES_FILTERS_REGEX,
  DEFAULT_PLAY_TIMEOUT,
  type StoryObj,
  type TestParams,
  PlaitedFixture,
} from 'plaited/testing'
import { kebabCase } from 'plaited/utils'

const createStoryRoute = ({ storyFile, exportName }: { storyFile: string; exportName: string }) => {
  const dirname = path.dirname(storyFile)
  const basename = kebabCase(path.basename(storyFile.replace(STORIES_FILTERS_REGEX, '')))
  const storyName = kebabCase(exportName)
  const id = `${basename}--${storyName}`
  return `${dirname}/${id}`
}

const updateHTMLResponses = ({
  story,
  route,
  responses,
  storyFile,
  exportName,
  streamURL,
  libraryImportMap,
}: {
  story: StoryObj
  route: string
  responses: Map<string, Response>
  storyFile: string
  exportName: string
  streamURL: `/${string}`
  libraryImportMap: Record<string, string>
}): TestParams => {
  const entryPath = storyFile.replace(/\.tsx?$/, '.js')
  const args = story?.args ?? {}
  const styles = story?.parameters?.styles ?? {}
  const headers = story?.parameters?.headers?.(process.env) ?? new Headers()
  const tpl = story?.template
  const page = ssr(
    <html>
      <head>
        <title>Story:{path.basename(route)}</title>
        <link
          rel='shortcut icon'
          href='#'
        />
        <script
          trusted
          type='importmap'
        >
          {JSON.stringify({
            imports: libraryImportMap,
          })}
        </script>
      </head>
      <body>
        <PlaitedFixture
          p-name={exportName}
          p-route={route}
          p-entry={entryPath}
          p-file={storyFile}
          p-socket={streamURL}
          children={tpl?.(args)}
          {...styles}
        />
        <script
          trusted
          type='module'
        >
          {`import {PlaitedFixture} from 'plaited/testing'`}
        </script>
      </body>
    </html>,
  )
  responses.set(route, new Response(`<!DOCTYPE html>\n${page}`, { headers }))
  return {
    a11y: story?.parameters?.a11y,
    description: story?.description,
    scale: story?.parameters?.scale,
    timeout: story?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT,
  }
}

export const mapStoryResponses = async ({
  entries,
  responses,
  cwd,
  streamURL,
  libraryImportMap,
}: {
  entries: string[]
  responses: Map<string, Response>
  cwd: string
  streamURL: `/${string}`
  libraryImportMap: Record<string, string>
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
        const params = updateHTMLResponses({
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
