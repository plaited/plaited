import path from 'node:path'
import { createHostStyles, joinStyles, type HostStylesObject } from '../../main.js'
import { ssr, bElement } from '../../main.js'
import { type StoryObj } from '../../testing.js'
import { StoryFixture } from '../../testing/testing.fixture.js'
import { FIXTURE_EVENTS } from '../../testing/testing.constants.js'
import { zip } from './zip.js'
import { TEST_RUNNER_ROUTE } from '../workshop.constants.js'
import { getStoryUrl } from '../tool-get-story-url/tool-get-story-url.js'
import { type StoryMetadata } from '../workshop.schemas.js'

const getEntryPath = (route: string) => {
  const segments = route.split('/')
  const last = segments.pop()!
  return `${segments.join('/')}/${last.split('--')[0]}--index.js`
}

const createFixtureLoadScript = ({ importPath, exportName }: { importPath: string; exportName: string }) => `
import '${TEST_RUNNER_ROUTE}'
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
}: {
  story: StoryObj
  route: string
  exportName: string
}) => {
  const args = story?.args ?? {}
  const tpl = story?.template
  const styles = story?.parameters?.styles
  const importPath = getEntryPath(route)
  const styleObjects = [
    createHostStyles({
      display: 'contents',
    }),
    styles,
  ].filter(Boolean) as HostStylesObject[]
  const PlaitedStory = bElement({
    tag: 'plaited-story',
    shadowDom: <slot {...joinStyles(...styleObjects)} />,
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
        {...joinStyles({
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
const createHtmlRoutes = async ({
  filePath,
  fullPath,
  entrypointsMetadata,
  routes,
}: {
  filePath: string
  fullPath: string
  entrypointsMetadata: StoryMetadata[]
  routes: {
    [key: string]: Response
  }
}) => {
  const modules = await import(fullPath)
  await Promise.all(
    entrypointsMetadata.map(async ({ exportName }) => {
      const route = getStoryUrl({ filePath, exportName })
      const story = modules[exportName] as StoryObj
      const page = await createPageBundle({
        story,
        route,
        exportName,
      })
      const include = await createInclude({
        story,
        route,
      })
      Object.assign(routes, {
        ...page,
        ...include,
      })
    }),
  )
}

export const getHtmlRoutes = async (cwd: string, entries: [string, StoryMetadata[]][]) => {
  const routes: {
    [key: string]: Response
  } = {}
  await Promise.all(
    entries.map(async ([entry, entrypointsMetadata]) => {
      const filePath = entry.replace(new RegExp(`^${cwd}`), '')
      await createHtmlRoutes({ filePath, fullPath: entry, entrypointsMetadata, routes })
    }),
  )
  return routes
}
