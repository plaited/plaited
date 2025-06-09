import { $ } from 'bun'
import { mkdtemp, mkdir } from 'node:fs/promises'
import { sep, resolve } from 'node:path'
import { globEntries } from './workshop.utils.js'
import { createStoryRoute } from './create-story-route.js'
import { createTestPage } from './create-test-page.js'
import type { StoryObj, ServerParams } from './plaited-fixture.types.js'
import { STORY_USAGE } from './plaited-fixture.constants.js'
import type { WorkshopParams } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from './workshop.constants.js'

export const useTestingServer = async ({ cwd, background, color, designTokens, port = 3000 }: WorkshopParams) => {
  const tmp = resolve(`${import.meta.dir}`, '../../.plaited')
  await mkdir(tmp, { recursive: true })
  const output = await mkdtemp(`${tmp}${sep}`)
  const stories = new Map<string, ServerParams>()
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
            usage: story?.parameters?.usage ?? STORY_USAGE.test,
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

  process.on('SIGINT', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${tmp}`
    process.exit()
  })

  process.on('uncaughtException', (error) => {
    console?.error('Uncaught Exception:', error)
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console?.error('Unhandled Rejection at:', promise, 'reason:', reason)
    process.exit(1)
  })

  process.on('exit', async () => {
    await server?.stop(true)
    console.log('server stopped')
  })

  process.on('SIGTERM', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${tmp}`
    process.exit()
  })

  process.on('SIGHUP', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${tmp}`
    process.exit()
  })

  return {
    stories,
    server,
  }
}
