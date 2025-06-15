import type { AssetRoutes } from './routing.types.js'

export const useAssetServer = async ({
  port,
  getRoutes,
  development,
}: {
  getRoutes: () => Promise<AssetRoutes>
  port: number
  development?: Bun.ServeOptions['development']
}) => {
  const assetServer = Bun.serve({
    routes: await getRoutes(),
    development,
    port,
  })
  const reloadAssetServer = async () =>
    assetServer.reload({
      routes: await getRoutes(),
    })
  return { assetServer, reloadAssetServer }
}
