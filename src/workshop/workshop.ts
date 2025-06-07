import { globEntries, buildEntries } from './workshop.utils.js'
import { type StoryObj, type TestParams } from '../testing/assert.types.js'
import { createStoryRoute } from './create-story-route.js'
import { createTestPage } from './create-test-page.js'
import type { WorkshopParams } from './workshop.types.js'

export const workshop = async ({ cwd, output, background, color, designTokens }: WorkshopParams) => {
  const stories = new Map<string, TestParams>()
  const responses = new Map<string, Response>()
  const entrypoints = await globEntries(cwd)
  const values = await Promise.allSettled(
    entrypoints.flatMap(async (entry) => {
      const { default: _, ...rest } = (await import(entry)) as {
        [key: string]: StoryObj
      }
      return await Promise.all(
        Object.entries(rest).map(async ([exportName, story]) => {
          const filePath = entry.replace(new RegExp(`^${cwd}`), '')
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
    }),
  )
  const htmlEntries = values.flatMap((settled) => (settled.status === 'fulfilled' ? settled.value : []))
  await buildEntries({ output, htmlEntries, responses })
  return stories
}
