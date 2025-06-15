import { $ } from 'bun'
import { mkdtemp } from 'node:fs/promises'
import { sep } from 'node:path'
import type { BrowserContextOptions } from 'playwright'
import { OUTPUT_DIR } from '../../../.plaited.js'
import { type Signal } from '../../behavioral/use-signal.js'
import type { StoryObj } from '../testing/plaited-fixture.types.js'
import type { TestRoutes, AssetRoutes } from './routing.types.js'
import type { TestParams } from '../workshop.types.js'
import { globFiles } from './glob-files.js'
import { useAssetServer } from './use-asset-server.js'
import { getAssetRoutes } from './get-asset-routes.js'
import { useTestServer } from './use-test-server.js'
import { getTestRoutes } from './get-test-routes.js'
import { updateTestMap } from './update-test-map.js'

/** Glob pattern used to find story files within the project. */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

export const startServer = async ({
  cwd,
  development,
  port,
  testMapSignal,
  colorSignal,
  backgroundSignal,
  designTokensSignal,
  recordVideo,
  a11y,
}: {
  cwd: string
  development?: Bun.ServeOptions['development']
  port: number
  testMapSignal: Signal<Map<string, TestParams[]>>
  colorSignal: Signal<`var(${string})`>
  backgroundSignal: Signal<`var(${string})`>
  designTokensSignal: Signal<string>
  recordVideo?: BrowserContextOptions['recordVideo']
  a11y?: boolean
}) => {
  //Cleanup
  await $`rm -rf ${OUTPUT_DIR} && mkdir ${OUTPUT_DIR}`
  const output = await mkdtemp(`${OUTPUT_DIR}${sep}`)

  // Get Story Sets
  const entrypoints = await globFiles(cwd, STORY_GLOB_PATTERN)
  const storySetMap = new Map<string, Record<string, StoryObj>>()
  await Promise.all(
    entrypoints.map(async (entry) => {
      const { default: _, ...storySet } = (await import(entry)) as {
        [key: string]: StoryObj
      }
      storySetMap.set(entry, storySet)
    }),
  )

  // Setup Asset Server
  const { assetServer, reloadAssetServer } = await useAssetServer({
    port: port + 1,
    development,
    getRoutes: async () => {
      const assetRoutes: AssetRoutes = {}
      await Promise.all(
        storySetMap.entries().map(async ([entry, storySet]) => {
          const filePath = entry.replace(new RegExp(`^${cwd}`), '')
          const routes = await getAssetRoutes({
            cwd,
            background: backgroundSignal.get(),
            color: colorSignal.get(),
            designTokens: designTokensSignal.get(),
            output,
            storySet,
            entry,
            filePath,
          })
          Object.assign(assetRoutes, ...routes)
        }),
      )
      return assetRoutes
    },
  })

  // Setup test server
  const { testServer, reloadTestServer } = await useTestServer({
    port,
    development,
    getRoutes: async () => {
      const testMap = new Map<string, TestParams[]>()
      const testRoutes: TestRoutes = {}
      await Promise.all(
        storySetMap.entries().map(async ([entry, storySet]) => {
          const filePath = entry.replace(new RegExp(`^${cwd}`), '')
          const params = updateTestMap({
            storySet,
            filePath,
            recordVideo,
            a11y,
          })
          testMap.set(filePath, params)
          Object.assign(testRoutes, getTestRoutes({ params, assetServer }))
        }),
      )
      testMapSignal.set(testMap)
      return testRoutes
    },
    assetServer,
  })

  return {
    url: testServer.url,
    reload: async () => {
      await reloadAssetServer()
      await reloadTestServer()
    },
  }
}
