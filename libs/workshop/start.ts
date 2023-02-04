import { server } from '../server/mod.ts'
import { getStat } from '../utils/get-stat.ts'
import { WorkshopConfig } from './types.ts'
import { write } from './write/mod.ts'
import { watcher } from './watcher.ts'
import { defaultStoryHandlers } from './default-story-handlers.ts'
import { setup } from './setup.ts'
export const start = async ({
  assets,
  colorScheme,
  credentials,
  dev = true,
  errorHandler,
  exts,
  notFoundTemplate,
  pat = false,
  playwright,
  port = 3000,
  project,
  root,
  storyHandlers = defaultStoryHandlers,
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
    exts,
    port,
    project,
    root,
    storyHandlers,
    playwright,
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
      exts,
      port,
      root,
      storyHandlers,
      playwright,
      updateRoutes,
    })
  }
}
