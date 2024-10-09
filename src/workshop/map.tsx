import path from 'path'
import { type FunctionTemplate } from '../jsx/jsx.types.ts'
import { PlaitedFixture, DEFAULT_PLAY_TIMEOUT } from './use-play.tsx'
import { useSSR } from '../jsx/use-ssr.ts'
import { USE_PLAY_ROUTE, STORIES_FILTERS_REGEX } from './workshop.constants.ts'
import type { StoryObj, Meta, TestParams } from './workshop.types.ts'
import { kebabCase } from '../utils/case.ts'
import type { BuildOutput } from 'bun'

const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}

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
  const storyPath = storyFile.replace(/\.tsx?$/, '.js')
  const scripts = [USE_PLAY_ROUTE, storyPath].filter((p) => p !== undefined)
  const ssr = useSSR(...scripts)
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

export const mapEntryResponses = async ({
  outputs,
  responseMap,
}: {
  outputs: BuildOutput['outputs']
  responseMap: Map<string, Response>
}) => {
  await Promise.all(
    outputs.map(async (blob) => {
      const { path, kind } = blob
      const text = await blob.text()
      const regex = new RegExp(`${USE_PLAY_ROUTE}$`)
      const resp = zip(text)
      const route =
        kind === 'entry-point' && regex.test(path) ? USE_PLAY_ROUTE
        : kind === 'entry-point' ? `/${path}`
        : path.replace(/^\./, '')
      responseMap.set(route, resp)
    }),
  )
}
