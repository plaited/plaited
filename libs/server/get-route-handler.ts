import { GetRouteHandler } from './types.ts'
import { getReloadRoute } from './get-reload-route.ts'
import { router } from './router.ts'

export const getRouteHandler: GetRouteHandler = ({
  routes,
  reload,
  reloadClients,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}) => {
  reload && routes.set(...getReloadRoute(reloadClients))
  return router(routes, { otherHandler, errorHandler, unknownMethodHandler })
}
