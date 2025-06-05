import path from 'node:path'
import { type StoryObj } from '../testing/assert.types.js'
import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../jsx/ssr.js'
import { getLiveReloadScript } from './workshop.utils.js'

export type Createstpage = {
  story: StoryObj
  route: string
  responses: Map<string, Response>
  relativePath: string
  exportName: string
  imports: Record<string, string>
  port: number
}

export const createTestPage = ({ story, route, responses, relativePath, exportName, imports, port }: Createstpage) => {
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
          {`import {PlaitedFixture} from 'plaited/testing'
            ${getLiveReloadScript(port)}
          `}
        </script>
      </body>
    </html>,
  )
  responses.set(route, new Response(`<!DOCTYPE html>\n${page}`, { headers }))
}
