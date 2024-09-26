import path from 'path'
import { FunctionTemplate } from '../jsx/jsx.types.js'
import { UseTestFixture } from './use-play.js'
import { useSSR } from './use-ssr.js'
import { USE_PLAY_ROUTE, STORIES_FILTERS_REGEX } from './workshop.constants.js'
import { StoryObj, Meta } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from '../assert/assert.constants.js'
import { css } from '../css/css.js'
import { kebabCase } from '../utils/case.js'
import { BuildOutput } from 'bun'
import { zip, jsMimeTypes } from './zip.js'

const Story: FunctionTemplate<{ route: string }> = ({ children, route }) => {
  const id = path.basename(route)
  return (
    <html>
      <head>
        <title>Story:{id}</title>
      </head>
      <body>{children}</body>
    </html>
  )
}

const objectToHeader = (obj: Record<string, string>) => {
  return Object.entries(obj)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('; ')
}

const createStoryRoute = ({
  storyFile,
  exportName,
}:{
  storyFile: string,
  exportName: string,
}) => {
  const dirname = path.dirname(storyFile)
  const basename =
    STORIES_FILTERS_REGEX.test(storyFile) ? kebabCase(path.basename(storyFile.replace(STORIES_FILTERS_REGEX, ''))) : ''
  const storyName = kebabCase(exportName)
  const id = basename ? `${basename}--${storyName}` : basename
  return `${dirname}/${id}`
}


const updateHTMLResponses = ({
  story,
  meta,
  route,
  responseMap,
  storyFile,
}: {
  story: StoryObj
  meta: Meta
  route: string
  responseMap: Map<string, Response>
  storyFile: string
}) => {
  const scripts = [story?.play && USE_PLAY_ROUTE, storyFile].filter((p) => p !== undefined)
  const ssr = useSSR(...scripts)
  const args = {
    ...meta?.args,
    ...story?.args,
  }
  const a11y =
    story?.parameters?.a11y === false ? 'false'
    : meta?.parameters?.a11y === false && !story?.parameters?.a11y ? 'false'
    : objectToHeader({
        ...meta?.parameters?.a11y,
        ...story?.parameters?.a11y,
      })
  const timeout = story?.parameters?.timeout ?? meta?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT
  const cookies = objectToHeader({
    ...story?.parameters?.cookies,
    ...meta?.parameters?.cookies,
  })
  const tpl = story?.template ?? meta?.template
  const page = ssr(
    <Story route={route}>
      <UseTestFixture
        children={tpl?.(args)}
        {...css.assign(meta?.parameters?.style, story?.parameters?.style)}
      />
    </Story>,
  )
  const headers = new Headers({
    'Content-Type': 'text/html',
    Cookies: cookies,
    Timeout: `${timeout}`,
    A11y: a11y,
  })
  responseMap.set(route, new Response(`<!DOCTYPE html>\n${page}`, { headers }))
}

export const mapStoryResponses = async ({
  storyEntries,
  responseMap,
  cwd,
}: {
  storyEntries: string[]
  responseMap: Map<string, Response>
  cwd: string
}) => {
  await Promise.all(
    storyEntries.map(async (entry) => {
      const { default: meta, ...stories } = (await import(entry)) as { 
        default: Meta,
        [key: string]: StoryObj 
      }
      const storyFile = entry.replace(new RegExp(`^${cwd}`), '')
      for(const exportName in stories) {
        const route = createStoryRoute({ storyFile, exportName })
        const story = stories[exportName]
        updateHTMLResponses({ story, meta, route, responseMap, storyFile })
      }
    }),
  )
}

export const mapEntryResponses = async ({
  outputs,
  responseMap,
}:{
  outputs: BuildOutput['outputs']
  responseMap: Map<string, Response>
}) => {
  await Promise.all(
    outputs.map(async (blob) => {
      const { path, kind } = blob
      const text = await blob.text()
      const regex = new RegExp(`${USE_PLAY_ROUTE}$`)
      const resp = zip(text, jsMimeTypes[0])
      const route = kind === 'entry-point' && regex.test(path)
        ? USE_PLAY_ROUTE
        :  kind === 'entry-point'
        ? `/${path}`
        : path.replace(/^\./, '')
      responseMap.set(route, resp)
    }),
  )
}
