import path from 'node:path'

import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../../jsx/ssr.js'
import type { StoryObj } from '../testing/plaited-fixture.types.js'
import { createStoryRoute } from './create-story-route.js'
import type { StorySet } from '../workshop.types.js'
import { zip } from './zip.js'
import { WORKSHOP_ROUTE, FIXTURE_EVENTS } from '../testing/testing.constants.js'

const getEntryPath = (route: string) => {
  const segments = route.split('/')
  const last = segments.pop()!
  return `${segments.join('/')}/${last.split('--')[0]}--index.js`
}

const createFixtureLoadScript = ({ importPath, exportName }: { importPath: string; exportName: string }) => `
import '${WORKSHOP_ROUTE}'
import { ${exportName} } from '${importPath}'

await customElements.whenDefined("${PlaitedFixture.tag}")
const fixture = document.querySelector("${PlaitedFixture.tag}");
fixture?.trigger({
  type: '${FIXTURE_EVENTS.run}',
  detail:  {play: ${exportName}?.play, timeout: ${exportName}?.params?.timeout}
});
`

const createPageBundle = async ({
  story,
  route,
  exportName,
  designTokens,
}: {
  story: StoryObj
  route: string
  exportName: string
  designTokens?: string
}) => {
  const args = story?.args ?? {}
  const tpl = story?.template
  const styles = story?.parameters?.styles
  const importPath = getEntryPath(route)
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
      <body {...styles}>
        <PlaitedFixture children={tpl?.(args)} />
        <script
          defer
          type='module'
          trusted
        >
          {createFixtureLoadScript({ importPath, exportName })}
        </script>
      </body>
    </html>,
  )
  return {
    [route]: zip({
      content: `<!DOCTYPE html>\n${page}`,
      contentType: 'text/html;charset=utf-8',
      headers: story?.parameters?.headers && (await story?.parameters?.headers(process.env)),
    }),
  }
}

const createInclude = async ({ story, route }: { story: StoryObj; route: string }) => {
  const args = story?.args ?? {}
  const Template = story?.template
  if (!Template) return {}
  const importPath = getEntryPath(route)
  const content = ssr(
    <Template {...args} />,
    <script
      type='module'
      trusted
      src={importPath}
    />,
  )
  return {
    [`${route}.template`]: zip({
      content,
      contentType: 'text/html;charset=utf-8',
    }),
  }
}

export const getHTMLRoutes = async ({
  designTokens,
  storySet,
  filePath,
}: {
  storySet: StorySet
  filePath: string
  designTokens?: string
}) => {
  return await Promise.all(
    Object.entries(storySet).flatMap(async ([exportName, story]) => {
      const route = createStoryRoute({ filePath, exportName })
      const page = await createPageBundle({
        story,
        route,
        exportName,
        designTokens,
      })
      const include = await createInclude({
        story,
        route,
      })
      return {
        ...page,
        ...include,
      }
    }),
  )
}
