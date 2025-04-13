import path from 'node:path'
import { DEFAULT_PLAY_TIMEOUT } from '../testing/assert.constants.js'
import { type StoryObj, type TestParams } from '../testing/assert.types.js'
import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../jsx/ssr.js'

export type GetHTMLResponse = ({
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
}) => TestParams

export const defaultGetHTMLResponse: GetHTMLResponse = ({
  story,
  route,
  responses,
  storyFile,
  exportName,
  streamURL,
  libraryImportMap,
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
