import type { AssetRoutes } from './workshop.types.js'

export const useAssetServer = ({
  port,
  routes,
  development,
}: {
  routes: AssetRoutes
  port: number
  development?: Bun.ServeOptions['development']
}) =>
  Bun.serve({
    routes,
    development,
    port,
  })
