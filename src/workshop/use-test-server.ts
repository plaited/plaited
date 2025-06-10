import { $ } from 'bun'
import { mkdtemp } from 'node:fs/promises'
import { sep } from 'node:path'
import { globStoryFiles } from './glob-story-files.js'
import { createStoryRoute } from './routing/create-story-route.js'
import { createTestPage } from './routing/get-asset-routes.js'
import type { StoryObj } from './testing/plaited-fixture.types.js'
import type { WorkshopParams, TestParams } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from './workshop.constants.js'
import { OUTPUT_DIR } from '../../.plaited.js'

export const useTestServer = async ({ cwd, background, color, designTokens, port = 3000 }: WorkshopParams) => {
  const stories = new Map<string, TestParams[]>()

  await $`rm -rf ${OUTPUT_DIR} && mkdir ${OUTPUT_DIR}`

  const output = await mkdtemp(`${OUTPUT_DIR}${sep}`)

  const entrypoints = await globStoryFiles(cwd)

  const values = await Promise.allSettled(
    entrypoints.flatMap(async (entry) => {
      const { default: _, ...rest } = (await import(entry)) as {
        [key: string]: StoryObj
      }
      const filePath = entry.replace(new RegExp(`^${cwd}`), '')
      stories.set(filePath, [])
      return await Promise.all(
        Object.entries(rest).flatMap(async ([exportName, story]) => {
          const route = createStoryRoute({ filePath, exportName })
          stories.get(filePath)?.push({
            route,
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

  process.on('SIGINT', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${OUTPUT_DIR}`
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
    await $`rm -rf ${OUTPUT_DIR}`
    process.exit()
  })

  process.on('SIGHUP', async () => {
    console.log('\n...stopping server')
    await $`rm -rf ${OUTPUT_DIR}`
    process.exit()
  })

  return {
    stories,
    server,
  }
}
