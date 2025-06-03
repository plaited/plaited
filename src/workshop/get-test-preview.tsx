import path from 'node:path'
import { DEFAULT_PLAY_TIMEOUT } from '../testing/assert.constants.js'
import { type StoryObj, type TestParams } from '../testing/assert.types.js'
import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../jsx/ssr.js'

export type GetTestPreview = ({
  story,
  route,
  responses,
  relativePath,
  exportName,
  streamURL,
  imports,
}: {
  story: StoryObj
  route: string
  responses: Map<string, Response>
  relativePath: string
  exportName: string
  streamURL: `/${string}`
  imports: Record<string, string>
}) => TestParams

export const getTestPreview: GetTestPreview = ({
  story,
  route,
  responses,
  relativePath,
  exportName,
  imports,
}): TestParams => {
  const entryPath = relativePath.replace(/\.tsx?$/, '.js')
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
          p-file={relativePath}
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
