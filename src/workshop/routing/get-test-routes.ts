import type { TestParams, TestRoutes } from '../workshop.types'

export const getTestRoutes = ({ params, assetServer }: { params: TestParams[]; assetServer: Bun.Server }) => {
  const toRet: TestRoutes = {}
  for (const { route, headers } of params) {
    toRet[route] = async () => {
      return await fetch(new URL(route, assetServer.url), {
        headers: headers?.(process.env),
      })
    }
  }
  return toRet
}
