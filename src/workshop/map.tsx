import path from 'path'
import { type FunctionTemplate } from '../jsx/jsx.types.js'
import { PlaitedFixture, DEFAULT_PLAY_TIMEOUT } from './use-play.js'
import { useSSR } from '../jsx/use-ssr.js'
import { USE_PLAY_ROUTE, STORIES_FILTERS_REGEX } from './workshop.constants.js'
import type { StoryObj, Meta, TestParams } from './workshop.types.js'
import { kebabCase } from '../utils/case.js'

const Page: FunctionTemplate<{ route: string }> = ({ children, route }) => {
  const id = path.basename(route)
  return (
    <html>
      <head>
        <title>Story:{id}</title>
        <link
          rel='shortcut icon'
          href='#'
        />
        <script
          trusted
          type='importmap'
        >
          {JSON.stringify({
            imports: {
              'plaited/jsx-runtime': '/jsx/runtime.js',
            },
          })}
        </script>
      </head>
      <body>{children}</body>
    </html>
  )
}

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
  responseMap,
  storyFile,
  exportName,
  websocketUrl,
}: {
  story: StoryObj
  meta: Meta
  route: string
  responseMap: Map<string, Response>
  storyFile: string
  exportName: string
  websocketUrl: `/${string}`
}): TestParams => {
  const ssr = useSSR(USE_PLAY_ROUTE, storyFile.replace(/\.tsx?$/, '.js'))
  const args = story?.args ?? meta?.args ?? {}
  const styles = story?.parameters?.styles ?? meta?.parameters?.styles ?? {}
  const headers = story?.parameters?.headers?.(process.env) ?? meta?.parameters?.headers?.(process.env) ?? new Headers()
  const tpl = story?.template ?? meta?.template
  const page = ssr(
    <Page route={route}>
      <PlaitedFixture
        p-name={exportName}
        p-route={route}
        p-file={storyFile}
        p-socket={websocketUrl}
        children={tpl?.(args)}
        {...styles}
      />
    </Page>,
  )
  responseMap.set(route, new Response(`<!DOCTYPE html>\n${page}`, { headers }))
  return {
    a11y: story?.parameters?.a11y ?? meta?.parameters?.a11y,
    description: story?.parameters?.description ?? meta?.parameters?.description,
    scale: story?.parameters?.scale ?? meta?.parameters?.scale,
    timeout: story?.parameters?.timeout ?? meta?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT,
  }
}

export const mapStoryResponses = async ({
  storyEntries,
  responseMap,
  cwd,
  websocketUrl,
}: {
  storyEntries: string[]
  responseMap: Map<string, Response>
  cwd: string
  websocketUrl: `/${string}`
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
        const params = updateHTMLResponses({ story, meta, route, responseMap, storyFile, exportName, websocketUrl })
        routes.push([route, params])
      }
    }),
  )
  return routes
}
