import path from 'node:path'
import { PlaitedFixture } from './testing/plaited-fixture.js'
import { ssr } from '../jsx/ssr.js'
import { PLAY_EVENT } from './testing/plaited-fixture.constants.js'
import type { StoryObj } from './testing/plaited-fixture.types.js'
import type { PageOptions } from './workshop.types.js'
import { wait } from '../utils/wait.js'
import { createStoryRoute } from './create-story-route.js'
import type { WorkshopParams, Stories } from './workshop.types.js'

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
  const styles = story?.parameters?.styles
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
        <PlaitedFixture
          children={tpl?.(args)}
          {...styles}
        />
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

type SetStorySetParams = {
  entry: string
  output: string
  stories: Stories
  filePath: string
} & WorkshopParams

export const getStorySetRoutes = async ({
  background,
  color,
  designTokens,
  entry,
  output,
  stories,
  filePath,
}: SetStorySetParams) => {
  return await Promise.all(
    Object.entries(stories).flatMap(async ([exportName, story]) => {
      const route = createStoryRoute({ filePath, exportName })
      return await createTestPage({
        output,
        story,
        route,
        entry,
        exportName,
        background,
        color,
        designTokens,
      })
    }),
  )
}
