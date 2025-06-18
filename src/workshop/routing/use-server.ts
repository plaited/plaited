import { $ } from 'bun'
import { mkdtemp } from 'node:fs/promises'
import { sep } from 'node:path'
import { OUTPUT_DIR } from '../../../.plaited.js'
import { useSignal, type Signal } from '../../behavioral/use-signal.js'
import type { StoryObj } from '../testing/plaited-fixture.types.js'
import type { StoryParams } from '../workshop.types.js'
import { globFiles } from './glob-files.js'
import { getAssetRoutes } from './get-routes.js'
import { addStoryParams } from './add-story-params.js'

/** Glob pattern used to find story files within the project. */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

export const useServer = async ({
  cwd,
  development,
  port,
  designTokensSignal,
}: {
  cwd: string
  development?: Bun.ServeOptions['development']
  port: number
  designTokensSignal: Signal<string>
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
  const storyParamSetSignal = useSignal<Set<StoryParams>>(new Set())
  
  const getRoutes = async () => {
    const bundledRoutes = {}
    await Promise.all(
      storySets.entries().map(async ([entry, storySet]) => {
        const filePath = entry.replace(new RegExp(`^${cwd}`), '')
        addStoryParams({filePath, storySet, storyParamSetSignal})
        const routes = await getAssetRoutes({
          designTokens: designTokensSignal.get(),
          output,
          storySet,
          entry,
          filePath,
        })
        Object.assign(bundledRoutes, ...routes)
      }),
    )
    return bundledRoutes
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

  const reload = async () => {
    storyParamSetSignal.set(new Set())
    return server.reload({
      routes: await getRoutes(),
    })
  }

  return {
    url: server.url,
    reload,
    storyParamSetSignal
  }
}
