import { server } from '../server/mod.ts'
import { Ext, WorkshopConfig } from './types.ts'
import { write } from './write.ts'
import { watcher } from './watcher.ts'
import { toFileUrl } from '../deps.ts'

interface StartWorkshop {
  (
    args: WorkshopConfig & {
      assets: string
      exts: Ext
      playwright: string
      workspace: string
    },
  ): Promise<void>
}

export const startWorkshop: StartWorkshop = async ({
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
}) => {
  if (!Deno.statSync(assets)) {
    await Deno.mkdir(assets)
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
      root: workspace,
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
      root: workspace,
    })
  }
  Deno.addSignalListener('SIGINT', async () => {
    await ref.close()
    Deno.exit()
  })
}
