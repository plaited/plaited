import { start as server } from '../server/mod.ts'
import { WorkshopConfig } from './types.ts'
import { write } from './write.ts'
import { watcher } from './watcher.ts'
import { resolve, toFileUrl } from '../deps.ts'

export const start = ({
  assets,
  colorScheme,
  credentials,
  dev = true,
  exts,
  importMap,
  playwright,
  port = 3000,
  project,
  workspace,
  includes,
}: WorkshopConfig) => {
  const root = workspace && workspace.startsWith('/')
    ? workspace
    : workspace
    ? resolve(Deno.cwd(), workspace)
    : Deno.cwd()
  if (!Deno.statSync(assets)) {
    console.error(`[ERR] Assets directory ${assets} does not exist!`)
    Deno.exit()
  }
  if (!Deno.statSync(assets).isDirectory) {
    console.error(`[ERR] Assets directory "${assets}" is not directory!`)
    Deno.exit()
  }
  const ref: { close: () => Promise<void> } = {
    async close() {},
  }
  const startServer = async () => {
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
    const { close } = await server({
      reload: dev,
      routes,
      port,
      root: assets,
      credentials,
    })
    ref['close'] = close
  }
  if (dev) {
    watcher({
      ref,
      startServer,
      root,
    })
  }
  Deno.addSignalListener('SIGINT', async () => {
    await ref.close()
    Deno.exit()
  })
}
