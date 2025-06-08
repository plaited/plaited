import path from 'node:path'
import { PlaitedFixture } from './plaited-fixture.js'
import { ssr } from '../jsx/ssr.js'
import { PLAY_EVENT } from './workshop.constants.js'
import type { PageOptions, StoryObj } from './workshop.types.js'
import { wait } from '../utils/wait.js'

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
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/workshop'
import { ${exportName} } from '${importPath}'

import.meta.hot.accept();

await customElements.whenDefined(PlaitedFixture.tag)
const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
fixture?.trigger({
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
          src='./index.ts'
        />
      </body>
    </html>,
  )
  const htmlPath = `${storyPath}/index.html`
  const html = `<!DOCTYPE html>\n${page}`
  await Bun.write(`${storyPath}/index.ts`, createFixtureLoadScript({ importPath, route, exportName, entry }))
  await wait(60)
  await Bun.write(htmlPath, html)
  const { default: resp } = await import(htmlPath)
  return { [route]: resp }
}
