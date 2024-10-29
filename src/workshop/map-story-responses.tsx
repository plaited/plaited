import path from 'path'
import { PlaitedFixture } from '../assert/plaited-fixture.js'
import { useSSR } from '../jsx/use-ssr.js'
import { PLAITED_ASSERT_ROUTE, STORIES_FILTERS_REGEX, DEFAULT_PLAY_TIMEOUT } from '../assert/assert.constants.js'
import type { StoryObj, Meta, TestParams } from '../assert/assert.types.js'
import { kebabCase } from '../utils/case.js'

const createStoryRoute = ({ storyFile, exportName }: { storyFile: string; exportName: string }) => {
  const dirname = path.dirname(storyFile)
  const basename = kebabCase(path.basename(storyFile.replace(STORIES_FILTERS_REGEX, '')))
  const storyName = kebabCase(exportName)
  const id = `${basename}--${storyName}`
  return `${dirname}/${id}`
}

const updateHTMLResponses = ({
  story,
  meta,
  route,
  responses,
  storyFile,
  exportName,
  runnerPath,
  imports,
}: {
  story: StoryObj
  meta: Meta
  route: string
  responses: Map<string, Response>
  storyFile: string
  exportName: string
  runnerPath: `/${string}`
  imports: Record<string, string>
}): TestParams => {
  const entryPath = storyFile.replace(/\.tsx?$/, '.js')
  const ssr = useSSR(PLAITED_ASSERT_ROUTE, entryPath)
  const args = story?.args ?? meta?.args ?? {}
  const styles = story?.parameters?.styles ?? meta?.parameters?.styles ?? {}
  const headers = story?.parameters?.headers?.(process.env) ?? meta?.parameters?.headers?.(process.env) ?? new Headers()
  const tpl = story?.template ?? meta?.template
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
          p-socket={runnerPath}
          children={tpl?.(args)}
          {...styles}
        />
      </body>
    </html>,
  )
  responses.set(route, new Response(`<!DOCTYPE html>\n${page}`, { headers }))
  return {
    a11y: story?.parameters?.a11y ?? meta?.parameters?.a11y,
    description: story?.parameters?.description ?? meta?.parameters?.description,
    scale: story?.parameters?.scale ?? meta?.parameters?.scale,
    timeout: story?.parameters?.timeout ?? meta?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT,
  }
}

export const mapStoryResponses = async ({
  storyEntries,
  responses,
  cwd,
  runnerPath,
  imports,
}: {
  storyEntries: string[]
  responses: Map<string, Response>
  cwd: string
  runnerPath: `/${string}`
  imports: Record<string, string>
}) => {
  const routes: [string, TestParams][] = []
  await Promise.all(
    storyEntries.map(async (entry) => {
      const { default: meta, ...stories } = (await import(entry)) as {
        default: Meta
        [key: string]: StoryObj
      }
      const storyFile = entry.replace(new RegExp(`^${cwd}`), '')
      for (const exportName in stories) {
        const route = createStoryRoute({ storyFile, exportName })
        const story = stories[exportName]
        const params = updateHTMLResponses({
          story,
          meta,
          route,
          responses,
          storyFile,
          exportName,
          runnerPath,
          imports,
        })
        routes.push([route, params])
      }
    }),
  )
  return routes
}
