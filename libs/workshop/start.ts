import { Routes, start as server } from '../server/mod.ts'
import { WorkshopConfig } from './types.ts'
import { write } from './write.ts'
import { watcher } from './watcher.ts'
import { setup } from './setup.ts'
import { dirname, resolve, toFileUrl } from '../deps.ts'
export const start = async ({
  assets,
  colorScheme,
  credentials,
  dev = true,
  errorHandler,
  exts,
  importMap,
  pat = false,
  playwright,
  port = 3000,
  project,
  root,
  includes,
  unknownMethodHandler,
}: WorkshopConfig) => {
  if (!Deno.statSync(assets)) {
    console.error(`[ERR] Assets directory ${assets} does not exist!`)
    Deno.exit()
  }
  if (!Deno.statSync(assets).isDirectory) {
    console.error(`[ERR] Assets directory "${assets}" is not directory!`)
    Deno.exit()
  }
  if (!Deno.statSync(root)) {
    console.error(`[ERR] Root directory ${root} does not exist!`)
    Deno.exit()
  }

  if (!Deno.statSync(assets).isDirectory) {
    console.error(`[ERR] Root directory "${assets}" is not directory!`)
    Deno.exit()
  }
  await setup({
    credentials,
    pat,
    playwright,
    port,
    project,
  })
  const getRoutes = async () =>
    await write({
      assets,
      colorScheme,
      dev,
      exts,
      importMap: importMap ? toFileUrl(importMap) : undefined,
      includes,
      playwright,
      port,
      project,
      root,
    })
  const startServer = async (routes: Routes) => {
    const { close } = await server({
      reload: dev,
      routes,
      port,
      root: assets,
      credentials,
      errorHandler,
      unknownMethodHandler,
    })
    return close
  }
  const routes = await getRoutes()
  const close = await startServer(routes)
  if (dev) {
    watcher({
      close,
      getRoutes,
      startServer,
      root,
    })
  }
}

const configPath = resolve(Deno.cwd(), Deno.args[0])
const configDir = dirname(configPath)
const { default: config } = await import(configPath)
start({
  ...config,
  playwright: resolve(configDir, config.playwright),
  importMap: resolve(configDir, config.importMap),
  assets: resolve(configDir, config.assets),
  root: resolve(configDir, config.root),
})
