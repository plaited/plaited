import path from 'node:path'

import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../../jsx/ssr.js'
import { FIXTURE_EVENTS } from '../testing/plaited-fixture.constants.js'
import type { StoryObj } from '../testing/plaited-fixture.types.js'
import type { StylesObject } from '../../main/css.types.js'
import { wait } from '../../utils/wait.js'
import { createStoryRoute } from './create-story-route.js'
import type { StorySet } from '../workshop.types.js'

const createFixtureLoadScript = ({ importPath, exportName }: { importPath: string; exportName: string }) => `
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/workshop'
import { ${exportName} } from '${importPath}'

await customElements.whenDefined(PlaitedFixture.tag)
const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
${exportName}.play && fixture?.trigger({
  type: '${FIXTURE_EVENTS.PLAY}',
  detail:  {play: ${exportName}.play, timeout: ${exportName}?.params?.timeout}
});
`
export type PageOptions = {
  output: string
  bodyStyles?: StylesObject
  designTokens?: string
}

export type CreatePageBundleParams = {
  story: StoryObj
  route: string
  entry: string
  exportName: string
} & PageOptions

export const createPageBundle = async ({
  story,
  route,
  entry,
  exportName,
  bodyStyles,
  designTokens,
  output,
}: CreatePageBundleParams) => {
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
      <body {...bodyStyles}>
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
  await Bun.write(`${storyPath}/index.ts`, createFixtureLoadScript({ importPath, exportName }))
  await wait(60)
  await Bun.write(htmlPath, html)
  const { default: resp } = await import(htmlPath)
  return { [route]: resp }
}

export type CreateIncludeBundleParams = {
  story: StoryObj
  route: string
} & Pick<PageOptions, 'output'>

export const createInclude = async ({ story, route, output }: CreateIncludeBundleParams) => {
  const args = story?.args ?? {}
  const Template = story?.template
  if (!Template) return {}
  const fragment = (
    <>
      <Template {...args} />
      <script
        type='module'
        trusted
        src='./index.ts'
      />
    </>
  )
  const storyPath = path.resolve(output, `.${route}`)
  const htmlPath = `${storyPath}/template.html`
  await wait(60)
  await Bun.write(htmlPath, fragment)
  const { default: resp } = await import(htmlPath)
  return { [`${route}.template`]: resp }
}

export type GetAssetRoutesParams = {
  entry: string
  storySet: StorySet
  filePath: string
} & PageOptions

export const getAssetRoutes = async ({
  bodyStyles,
  designTokens,
  entry,
  output,
  storySet,
  filePath,
}: GetAssetRoutesParams) => {
  return await Promise.all(
    Object.entries(storySet).flatMap(async ([exportName, story]) => {
      const route = createStoryRoute({ filePath, exportName })
      const page = await createPageBundle({
        output,
        story,
        route,
        entry,
        exportName,
        bodyStyles,
        designTokens,
      })
      const include = await createInclude({
        output,
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
