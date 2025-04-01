import path from 'path'
import { ssr } from 'plaited'
import { STORIES_FILTERS_REGEX, DEFAULT_PLAY_TIMEOUT, type StoryObj, type TestParams } from 'plaited/testing'
import { kebabCase } from 'plaited/utils'
import { PlaitedFixture } from './plaited-fixture.js'

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
  imports,
}: {
  story: StoryObj
  route: string
  responses: Map<string, Response>
  storyFile: string
  exportName: string
  streamURL: `/${string}`
  imports: Record<string, string>
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
            imports,
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
          type='module'
          trusted
        >
          {['/workshop/plaited-fixture.js', entryPath].map((path) => `import '${path}';`).join('\n')}
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
  storyEntries,
  responses,
  cwd,
  streamURL,
  imports,
}: {
  storyEntries: string[]
  responses: Map<string, Response>
  cwd: string
  streamURL: `/${string}`
  imports: Record<string, string>
}) => {
  const routes: [string, TestParams][] = []
  await Promise.all(
    storyEntries.map(async (entry) => {
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
          imports,
        })
        routes.push([route, params])
      }
    }),
  )
  return routes
}
