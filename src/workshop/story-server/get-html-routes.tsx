import path from 'node:path'

import { ssr, bElement, css, type HostStylesObject } from '../../main.js'
import { type StoryObj } from '../../testing.js'
import { StoryFixture } from '../../testing/testing.fixture.js'
import { FIXTURE_EVENTS } from '../../testing/testing.constants.js'
import { createStoryRoute, zip } from './story-server.utils.js'
import type { StorySet } from './story-server.types.js'
import { WORKSHOP_ROUTE } from './story-server.constants.js'
import type { Signal } from '../../behavioral/use-signal.js'

const getEntryPath = (route: string) => {
  const segments = route.split('/')
  const last = segments.pop()!
  return `${segments.join('/')}/${last.split('--')[0]}--index.js`
}

const createFixtureLoadScript = ({ importPath, exportName }: { importPath: string; exportName: string }) => `
import '${WORKSHOP_ROUTE}'
import { ${exportName} } from '${importPath}'

await customElements.whenDefined("${StoryFixture.tag}")
const fixture = document.querySelector("${StoryFixture.tag}");
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
  designTokens?: Signal<string>
}) => {
  const args = story?.args ?? {}
  const tpl = story?.template
  const styles = story?.parameters?.styles
  const importPath = getEntryPath(route)
  const tokens = designTokens?.get()
  const styleObjects = [
    css.host({
      display: 'contents',
    }),
    tokens && { stylesheets: [tokens] },
    styles,
  ].filter(Boolean) as HostStylesObject[]
  const PlaitedStory = bElement({
    tag: 'plaited-story',
    shadowDom: <slot {...css.join(...styleObjects)} />,
  })
  const page = ssr(
    <html>
      <head>
        <title>Story:{path.basename(route)}</title>
        <link
          rel='shortcut icon'
          href='#'
        />
      </head>
      <body
        {...css.join({
          stylesheets: [' body { height: 100vh; height: 100dvh; margin: 0'],
        })}
      >
        <PlaitedStory>
          <StoryFixture children={tpl?.(args)} />
        </PlaitedStory>
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
      content: `<!DOCTYPE html>
${page}`,
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

/**
 * @internal
 * Generates HTML routes for story rendering.
 * Creates full pages with fixtures and template-only includes.
 *
 * @param options - Route generation config
 * @param options.designTokens - Global CSS tokens signal
 * @param options.storySet - Story definitions by export name
 * @param options.filePath - Source file for import paths
 * @returns Route objects with compressed HTML responses
 */
export const getHTMLRoutes = async ({
  designTokens,
  storySet,
  filePath,
}: {
  storySet: StorySet
  filePath: string
  designTokens?: Signal<string>
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
