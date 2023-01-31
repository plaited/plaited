// import chokidar from 'chokidar'
// import fs from 'fs/promises'
// import { getStat } from '@plaited/node-utils'
// import { server } from '@plaited/server'
// import { WorkshopConfig } from './types.ts'
// import { copyAssets, assetsDir, root } from './utils/index.ts'
// import { write } from './write/index.ts'
// import { cleanupTests } from './utils/cleanup-tests.ts'
// import { getRoutes } from './utils/get-routes.ts'

export const start = async ({ removeDeadTest = true, reload = true, assets, ...config }: WorkshopConfig) => {
  const exist = await getStat(root)
  exist && await Deno.remove(root, { recursive: true })
  let { testFiles, specData, workFiles } = await write(config)
  let routes = await getRoutes(workFiles)
  assets && await copyAssets(assets)
  const { sendReload } = await server({
    reload,
    routes,
    root: assetsDir,
  })
  assets && chokidar.watch(assets).on('change', async () => {
    await copyAssets(assets)
  })
  reload && chokidar.watch(config.source).on('change', async () => {
    ({ testFiles, specData, workFiles } = await write(config))
    routes = await getRoutes(workFiles)
    if(removeDeadTest) {
      await cleanupTests(testFiles.filter(Boolean), specData)
    }
    sendReload && sendReload()
  })
}
