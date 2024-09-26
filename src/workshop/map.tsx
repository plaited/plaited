import path from 'path'
import { FunctionTemplate } from '../jsx/jsx.types.js'
import { UseTestFixture } from './use-play.js'
import { useSSR } from './use-ssr.js'
import { USE_PLAY_ROUTE } from './workshop.constants.js'
import { StoryObj } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from '../assert/assert.constants.js'
import { css } from '../css/css.js'
import { transpiler } from './scan.js'
import { BuildOutput } from 'bun'
import { zip, jsMimeTypes } from './zip.js'

const Page: FunctionTemplate<{ route: string }> = ({ children, route }) => {
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

export const mapStories = async ({
  storyMap,
  responseMap,
}: {
  storyMap: [string, string][]
  responseMap: Map<string, Response>
}) => {
  await Promise.all(
    storyMap.map(async ([filePath, content]) => {
      const route = `/${filePath.replace(/\.ts$/, '')}`
      const {imports, exports} = transpiler.scan(content)
      const exportName = exports[0]
      const { path } = imports[0]

      const { [exportName]: story, default: meta } = (await import(path)) as { [key: string]: StoryObj }
      const scripts = [story?.play && USE_PLAY_ROUTE, `/${filePath.replace(/\.ts$/, '.js')}`].filter((p) => p !== undefined)
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
        <Page route={route}>
          <UseTestFixture
            children={tpl?.(args)}
            {...css.assign(meta?.parameters?.style, story?.parameters?.style)}
          />
        </Page>,
      )
      const headers = new Headers({
        'Content-Type': 'text/html',
        Cookies: cookies,
        Timeout: `${timeout}`,
        A11y: a11y,
      })
      responseMap.set(route, new Response(`<!DOCTYPE html>\n${page}`, { headers }))
    }),
  )
}

export const mapEntries = async (outputs: BuildOutput['outputs'], responseMap: Map<string, Response>) => {
  await Promise.all(
    outputs.map(async (blob) => {
      const { path } = blob
      const text = await blob.text()
      const regex = new RegExp(`${USE_PLAY_ROUTE}$`)
      const resp = zip(text, jsMimeTypes[0])
      responseMap.set(regex.test(path) ? USE_PLAY_ROUTE : `/${path.replace(/^\.\//, '')}`, resp)
    }),
  )
}
