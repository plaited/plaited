import { $ } from 'bun'
import { mkdtemp } from 'node:fs/promises'
import { sep } from 'node:path'
import type { BrowserContextOptions } from 'playwright'
import { OUTPUT_DIR } from '../../../.plaited.js'
import type { Signal } from '../../behavioral/use-signal.js'
import type { StylesObject } from '../../main/css.types.js'
import type { StoryObj } from '../testing/plaited-fixture.types.js'
import type { StoryParams } from '../workshop.types.js'
import { globFiles } from './glob-files.js'
import { getAssetRoutes } from './get-routes.js'
import { updateStorySetMap } from './update-story-set-map.js'

/** Glob pattern used to find story files within the project. */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

export const useServer = async ({
  cwd,
  development,
  port,
  storySetMapSignal,
  bodyStylesSignal,
  designTokensSignal,
  recordVideoSignal,
  a11ySignal,
}: {
  cwd: string
  development?: Bun.ServeOptions['development']
  port: number
  storySetMapSignal: Signal<Map<string, StoryParams[]>>
  bodyStylesSignal: Signal<StylesObject>
  designTokensSignal: Signal<string>
  recordVideoSignal: Signal<BrowserContextOptions['recordVideo'] | undefined>
  a11ySignal: Signal<boolean>
}) => {
  //Cleanup
  await $`rm -rf ${OUTPUT_DIR} && mkdir ${OUTPUT_DIR}`
  const output = await mkdtemp(`${OUTPUT_DIR}${sep}`)

  // Get Story Sets
  const entrypoints = await globFiles(cwd, STORY_GLOB_PATTERN)
  const storySets = new Map<string, Record<string, StoryObj>>()
  await Promise.all(
    entrypoints.map(async (entry) => {
      const { default: _, ...storySet } = (await import(entry)) as {
        [key: string]: StoryObj
      }
      storySets.set(entry, storySet)
    }),
  )
  const getRoutes = async () => {
    const storySetMap = new Map<string, StoryParams[]>()
    const bunldedRoutes = {}
    await Promise.all(
      storySets.entries().map(async ([entry, storySet]) => {
        const filePath = entry.replace(new RegExp(`^${cwd}`), '')
        const params = updateStorySetMap({
          storySet,
          filePath,
          recordVideoSignal,
          a11ySignal,
        })
        storySetMap.set(filePath, params)
        const routes = await getAssetRoutes({
          bodyStyles: bodyStylesSignal.get(),
          designTokens: designTokensSignal.get(),
          output,
          storySet,
          entry,
          filePath,
        })
        Object.assign(bunldedRoutes, ...routes)
      }),
    )
    storySetMapSignal.set(storySetMap)
    return bunldedRoutes
  }
  const server = Bun.serve({
    routes: await getRoutes(),
    development,
    port,
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

  const reload = async () =>
    server.reload({
      routes: await getRoutes(),
    })

  return {
    url: server.url,
    reload,
  }
}
