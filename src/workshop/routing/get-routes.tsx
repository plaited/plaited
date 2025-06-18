import path from 'node:path'

import { PlaitedFixture } from '../testing/plaited-fixture.js'
import { ssr } from '../../jsx/ssr.js'
import { FIXTURE_EVENTS } from '../testing/plaited-fixture.constants.js'
import type { StoryObj, CookiesCallback } from '../testing/plaited-fixture.types.js'
import { wait } from '../../utils/wait.js'
import { createStoryRoute } from './create-story-route.js'
import type { StorySet } from '../workshop.types.js'

const createFixtureLoadScript = ({ importPath, exportName }: { importPath: string; exportName: string }) => `
import { type PlaitedElement } from 'plaited'
import { PlaitedFixture } from 'plaited/workshop'
import { ${exportName} } from '${importPath}'

await customElements.whenDefined(PlaitedFixture.tag)
const fixture = document.querySelector<PlaitedElement>(PlaitedFixture.tag);
fixture?.trigger({
  type: '${FIXTURE_EVENTS.RUN}',
  detail:  {play: ${exportName}?.play, timeout: ${exportName}?.params?.timeout}
});
`

const createCookiesLoadScript = (route: string) => `void fetch(${route})`

type PageOptions = {
  output: string
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
  designTokens,
  output,
}: CreatePageBundleParams) => {
  const args = story?.args ?? {}
  const tpl = story?.template
  const styles = story?.parameters?.styles
  const hasCookies = Boolean(story?.parameters?.cookies)
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
        {hasCookies && <script trusted>{createCookiesLoadScript(`${route}.cookies`)}</script>}
        <style>{designTokens}</style>
      </head>
      <body {...styles}>
        <PlaitedFixture children={tpl?.(args)} />
        <script
          defer
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

export const createCookiesRoute = async (route: string, cb: CookiesCallback) => {
  const cookiesToSet = await cb(process.env)
  const validCookieNameRegex = /^[!#$%&'*+\-.^`|~0-9A-Za-z]+$/
  const headers = new Headers()
  for (const [key, value] of Object.entries(cookiesToSet)) {
    // 1. VALIDATE THE COOKIE NAME (KEY) - More correct than encoding.
    if (!validCookieNameRegex.test(key)) {
      console.warn(`[Story Dev Server] Invalid cookie name "${key}". Skipping. Adhere to RFC 6265 token spec.`)
      continue // Skip this invalid cookie
    }

    let finalValue

    // 2. SERIALIZE THE VALUE if it's an array.
    if (Array.isArray(value)) {
      finalValue = JSON.stringify(value)
    } else {
      // Ensure even non-array values like numbers or booleans become strings.
      finalValue = `${value}`
    }

    // 3. ENCODE THE FINAL SERIALIZED VALUE to make it a safe cookie-value.
    const encodedValue = encodeURIComponent(finalValue)

    // 4. ASSEMBLE the final cookie string with an un-encoded name and encoded value.
    const cookieString = `${key}=${encodedValue}; Path=/; SameSite=Lax; HttpOnly`

    headers.append('Set-Cookie', cookieString)
  }

  // Return the response with the correctly formatted headers
  return { [`${route}.cookies`]: new Response(null, { status: 204, headers }) }
}

export const getAssetRoutes = async ({
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
        designTokens,
      })
      const include = await createInclude({
        output,
        story,
        route,
      })
      let cookies: Record<string, Response> | undefined
      if (story?.parameters?.cookies) {
        cookies = await createCookiesRoute(route, story.parameters.cookies)
      }
      return {
        ...(cookies ?? {}),
        ...page,
        ...include,
      }
    }),
  )
}
