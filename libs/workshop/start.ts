import { server } from '../server/mod.ts'
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
  notFoundTemplate,
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
  const routes = await write({
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
  const { updateRoutes } = await server({
    dev,
    routes,
    port,
    root: assets,
    credentials,
    notFoundTemplate,
    errorHandler,
    unknownMethodHandler,
  })
  if (dev) {
    watcher({
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
      updateRoutes,
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
