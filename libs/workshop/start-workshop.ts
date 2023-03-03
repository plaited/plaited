import { getFileHandler, Routes, server } from '../server/mod.ts'
import { WorkshopConfig } from './types.ts'
import { setRoutes } from './set-routes.ts'
import { watcher } from './watcher.ts'
import { toFileUrl } from '../deps.ts'
import { getStat } from './get-stat.ts'

interface StartWorkshop {
  (
    args: WorkshopConfig & {
      assets: string
      workspace: string
    },
  ): Promise<void>
}

export const startWorkshop: StartWorkshop = async ({
  assets,
  credentials,
  dev = true,
  importMap,
  port = 3000,
  workspace,
}) => {
  await Promise.all([assets, workspace].map(async (path) => {
    const exist = await getStat(path)
    if (exist) return
    Deno.mkdir(path, { recursive: true })
  }))
  const routes: Routes = new Map()
  const { close, reloadClient, url } = await server({
    reload: dev,
    routes,
    port,
    root: assets,
    credentials,
    middleware: (handler) => async (req, ctx) => {
      const res = await getFileHandler({ assets, req })
      if (res) {
        return res
      }
      return await handler(req, ctx)
    },
  })
  const updateRoutes = () =>
    setRoutes({
      dev,
      host: url,
      routes,
      importMap: importMap ? toFileUrl(importMap) : undefined,
      workspace,
    })

  if (dev) {
    watcher({
      reloadClient,
      routes,
      updateRoutes,
      workspace,
    })
  }
  Deno.addSignalListener('SIGINT', async () => {
    await close()
    Deno.exit()
  })
}
