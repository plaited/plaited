import { GetRouteHandler } from './types.ts'
import { getReloadRoute } from './get-reload-route.ts'
import { router } from '../deps.ts'

export const getRouteHandler: GetRouteHandler = ({
  routes,
  reload,
  reloadClients,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}) => {
  return router(
    {
      ...routes,
      ...reload ? getReloadRoute(reloadClients) : {},
    },
    { otherHandler, errorHandler, unknownMethodHandler },
  )
}
