import path from 'node:path'
import type { StoryObj, StoryDetail } from '../testing/assert.types.js'
import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../jsx/ssr.js'
import { PLAY_EVENT, PLAITED_FIXTURE } from '../testing/assert.constants'
import type { PageOptions } from './workshop.types.js'

type Createstpage = {
  story: StoryObj
  route: string
  entry: string
  exportName: string
} & PageOptions

const createFixtureLoadScript = ({
  route,
  importPath,
  exportName,
  entry,
}: {
  importPath: string
  route: string
  exportName: string
  entry: string
}) => `
import { exportName } from '${importPath}'
await customElements.whenDefined("${PLAITED_FIXTURE}")
const fixture = document.querySelector("${PLAITED_FIXTURE}");
console.log('hit')
fixture.trigger({
  type: '${PLAY_EVENT}',
  detail: {
    route: "${route}",
    entry: "${entry}",
    exportName: "${exportName}",
    story: ${exportName}
  }
});
`

export const createTestPage = async ({
  story,
  route,
  entry,
  exportName,
  background,
  color,
  designTokens,
  output,
}: Createstpage) => {
  const args = story?.args ?? {}
  const tpl = story?.template
  const storyPath = path.resolve(output, `.${route}`)
  const importPath = path.relative(storyPath, entry)
  const page = ssr(
    <html>
      <head>
        <title>Story:{path.basename(route)}</title>
        <link
          rel='shortcut icon'
          href='#'
        />
        <style>{designTokens}</style>
      </head>
      <body style={{ background: background ?? '', color: color ?? '', margin: 0 }}>
        <PlaitedFixture children={tpl?.(args)} />
        <script
          type='module'
          trusted
          src='plaited/testing'
        />
        <script
          trusted
          type='module'
          id='story'
        >
          {createFixtureLoadScript({ importPath, route, exportName, entry })}
        </script>
      </body>
    </html>,
  )
  const html = `<!DOCTYPE html>\n${page}`
  return await Bun.write(`${storyPath}/index.html`, html)
}
