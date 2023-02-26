import { server } from '../server/mod.ts'
import { Ext, WorkshopConfig } from './types.ts'
import { write } from './write.ts'
import { getRoutes } from './get-routes.ts'
import { watcher } from './watcher.ts'
import { toFileUrl } from '../deps.ts'
import { getStat } from './get-stat.ts'

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
  credentials,
  dev = true,
  exts,
  importMap,
  port = 3000,
  project,
  workspace,
  includes,
}) => {
  await Promise.all([assets, workspace].map(async (path) => {
    const exist = await getStat(path)
    if (exist) return
    Deno.mkdir(path, { recursive: true })
  }))
  const writeFn = () =>
    write({
      assets,
      dev,
      exts,
      importMap: importMap ? toFileUrl(importMap) : undefined,
      workspace,
    })
  const obj = await writeFn()
  const routes = await getRoutes({
    ...obj,
    assets,
    dev,
    exts,
    includes,
    project,
  })
  const { close } = await server({
    reload: dev,
    routes,
    port,
    root: assets,
    credentials,
  })
  if (dev) {
    watcher({
      assets,
      dev,
      exts,
      getRoutes,
      includes,
      project,
      routes,
      workspace,
      writeFn,
    })
  }
  Deno.addSignalListener('SIGINT', async () => {
    await close()
    Deno.exit()
  })
}
