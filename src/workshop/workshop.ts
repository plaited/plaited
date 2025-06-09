import { globEntries } from './workshop.utils.js'
import { createStoryRoute } from './create-story-route.js'
import { createTestPage } from './create-test-page.js'
import type { StoryObj, Params } from './plaited-fixture.types.js'
import type { WorkshopParams } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from './workshop.constants.js'

export const workshop = async ({ cwd, output, background, color, designTokens, port = 3000 }: WorkshopParams) => {
  const stories = new Map<string, Params>()
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
          stories.set(route, {
            a11y: story?.parameters?.a11y,
            scale: story?.parameters?.scale,
            timeout: story?.parameters?.timeout ?? DEFAULT_PLAY_TIMEOUT,
          })
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
  const routes = values.flatMap((settled) => (settled.status === 'fulfilled' ? settled.value : []))
  const server = Bun.serve({
    port,
    development: {
      hmr: true,
      console: true,
    },
    routes: Object.assign({}, ...routes),
  })
  const stopServer = async () => {
    console.log('\n...stopping server')
    await server?.stop(true)
    console.log('server stopped')
  }

  process.on('SIGINT', async () => {
    await stopServer()
    process.exit()
  })

  process.on('uncaughtException', (error) => {
    console?.error('Uncaught Exception:', error)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console?.error('Unhandled Rejection at:', promise, 'reason:', reason)
  })

  process.on('exit', async () => {
    await stopServer()
    console.log('server stopped')
  })

  process.on('SIGTERM', async () => {
    await stopServer()
    process.exit()
  })

  process.on('SIGHUP', async () => {
    await stopServer()
    process.exit()
  })
  return stories
}
