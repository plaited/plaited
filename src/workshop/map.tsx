import { basename } from 'path'
import { FunctionTemplate } from '../jsx/jsx.types.js'
import { UseTestFixture } from './use-test-fixture.js'
import { useSSR } from './use-ssr.js'
import { USE_PLAY_ROUTE, STORY_EXTENSION } from './workshop.constants.js'
import { StoryObj } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from '../assert/assert.constants.js'
import { css } from '../css/css.js'

const Page: FunctionTemplate<{ route: string}> = ({ children, route }) => {
  const id = basename(route)
  return (
    <html>
      <head>
        <title>Story:{id}</title>
      </head>
      <body>
       {children}
      </body>
    </html>
  )
}

const objectToHeader = (obj: Record<string, string>) => {
  return Object.entries(obj)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('; ');
}

export const mapStories = async (cwd: string, stories: Map<string, {
  filePath: string;
  exportName: string;
  template: string;
}>) => {
  const virtualEntries = new Map<string, string>()
  const responseMap = new Map<string, Response>()
  for (const [route, { template, exportName, filePath, }] of stories) {
    const entryPath = `${route}${STORY_EXTENSION}`
    virtualEntries.set(entryPath, template)
    const { [exportName]: story, default: meta } = (await import(filePath)) as { [key: string]: StoryObj }
    const imports = [story?.play && USE_PLAY_ROUTE, entryPath].filter(p => p !== undefined)
    const ssr = useSSR(...imports)
    const args = {
      ...meta?.args,
      ...story?.args
    }
    const a11y = story?.parameters?.a11y === false
      ? 'false'
      : meta?.parameters?.a11y === false && !story?.parameters?.a11y
      ? 'false'
      : objectToHeader({
        ...meta?.parameters?.a11y,
        ...story?.parameters?.a11y
      })
    const timeout = story?.parameters?.timeout ?? meta?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT
    const cookies = objectToHeader({
      ...story?.parameters?.cookies,
      ...meta?.parameters?.cookies
    })
    const tpl = story?.template ?? meta?.template
    const page = ssr(
      <Page route={route}>
        <UseTestFixture children={tpl?.(args)} {...css.assign(meta?.parameters?.style, story?.parameters?.style)}/>
      </Page>
    ) 
    const headers = new Headers({
      'Content-Type': 'text/html',
      'Cookies': cookies,
      'Timeout': `${timeout}`,
      'A11y': a11y
    })
    responseMap.set(route, new Response(`<!DOCTYPE html>\n${page}`, { headers }))
  }
  return { virtualEntries, responseMap }
}