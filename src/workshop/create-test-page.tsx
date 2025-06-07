import path from 'node:path'
import { type StoryObj } from '../testing/assert.types.js'
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
  entry,
  entryPath,
  exportName,
}: {
  route: string
  entry: string
  entryPath: string
  exportName: string
}) => `
const { ${exportName} } = await import('${entry}');
await customElements.whenDefined("${PLAITED_FIXTURE}")
const fixture = document.querySelector("${PLAITED_FIXTURE}");
fixture.trigger({
  type: '${PLAY_EVENT}',
  detail: {
    route: "${route}",
    entry: "${entry}",
    entryPath: "${entryPath}",
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
  const entryPath = Bun.resolveSync(entry, output)
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
          trusted
          async
          type='module'
        >
          {createFixtureLoadScript({ exportName, entry, entryPath, route })}
        </script>
      </body>
    </html>,
  )
  const html = `<!DOCTYPE html>\n${page}`
  const filePath = Bun.resolveSync(`.${route}.html`, output)
  return await Bun.write(filePath, html)
}
